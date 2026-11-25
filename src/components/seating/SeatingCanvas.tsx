import type Konva from 'konva'
import { Maximize2, Minus, Plus } from 'lucide-react'
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent,
} from 'react'
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva'
import { Button } from '@/components/ui/button'
import { useThemeColors } from '@/hooks/useThemeColors'
import { SEAT_RADIUS, tableGeometry, toRoomPoint } from '@/lib/seatingGeometry'
import { cn } from '@/lib/utils'
import { seatKey, type SeatingLandmark, type SeatingRoom, type SeatingTable } from '@/types/seating'

// Typ danych przeciąganego gościa (lista gości -> krzesło na planie).
export const GUEST_DRAG_TYPE = 'application/x-seating-guest'

export type SeatVisual = {
  fill: string
  // kropka statusu na krawędzi krzesła
  dot?: string | null
  // inicjały na krześle
  label?: string | null
  // podpowiedź po najechaniu
  title?: string | null
  dimmed?: boolean
}

export type CanvasFocus = { tableId: string; seatNumber?: number; nonce: number }

type Patch<T> = Partial<T>

type SeatingCanvasProps = {
  room: SeatingRoom
  tables: readonly SeatingTable[]
  landmarks: readonly SeatingLandmark[]
  seatVisual: (tableId: string, seatNumber: number) => SeatVisual
  highlightedSeats?: ReadonlySet<string>
  highlightedTables?: ReadonlySet<string>
  selectedId?: string | null
  selectedSeat?: string | null
  // Stoły, których krzesła są nieaktywne (np. niezapisane).
  inactiveTables?: ReadonlySet<string>
  editable?: boolean
  // 'contain' - cała sala w kontenerze o zadanej wysokości (edytor),
  // 'width' - wysokość z proporcji sali (strona wydarzenia).
  fit?: 'contain' | 'width'
  wheelZoom?: boolean
  showGrid?: boolean
  focus?: CanvasFocus | null
  className?: string
  ariaLabel: string
  onSelect?: (id: string | null) => void
  onTableChange?: (id: string, patch: Patch<Pick<SeatingTable, 'x' | 'y' | 'rotation'>>) => void
  onLandmarkChange?: (id: string, patch: Patch<Omit<SeatingLandmark, 'id' | 'label'>>) => void
  onSeatClick?: (tableId: string, seatNumber: number) => void
  onTableClick?: (tableId: string) => void
  onGuestDrop?: (guestId: string, tableId: string, seatNumber: number) => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 8
const GRID = 10
const FOCUS_ZOOM = 2.5

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const snap = (value: number) => Math.round(value / GRID) * GRID
const normalizeAngle = (value: number) => Math.round((((value % 360) + 360) % 360) * 10) / 10 % 360

type View = { zoom: number; x: number; y: number }

export function SeatingCanvas({
  room,
  tables,
  landmarks,
  seatVisual,
  highlightedSeats,
  highlightedTables,
  selectedId = null,
  selectedSeat = null,
  inactiveTables,
  editable = false,
  fit = 'width',
  wheelZoom = false,
  showGrid = false,
  focus = null,
  className,
  ariaLabel,
  onSelect,
  onTableChange,
  onLandmarkChange,
  onSeatClick,
  onTableClick,
  onGuestDrop,
}: SeatingCanvasProps) {
  const colors = useThemeColors()
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })
  const [hover, setHover] = useState<{ text: string; left: number; top: number } | null>(null)
  const pinchRef = useRef<{ distance: number } | null>(null)

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const baseScale =
    size.width === 0
      ? 0
      : fit === 'contain' && size.height > 0
        ? Math.min(size.width / room.width, size.height / room.height)
        : size.width / room.width
  const stageWidth = size.width
  const stageHeight = fit === 'contain' ? size.height : Math.round(room.height * baseScale)
  const scale = baseScale * view.zoom
  // Sala wyśrodkowana przy zoomie 1.
  const originX = (stageWidth - room.width * baseScale) / 2
  const originY = (stageHeight - room.height * baseScale) / 2

  const resetView = useCallback(() => setView({ zoom: 1, x: 0, y: 0 }), [])

  // Pozycja stage'a: punkt (0,0) sali na ekranie.
  const stageX = originX * view.zoom + view.x
  const stageY = originY * view.zoom + view.y

  // factor względem bieżącego zoomu - kilka zdarzeń kółka przed renderem
  // sumuje się poprawnie.
  const zoomAt = useCallback(
    (factor: number, point: { x: number; y: number }) => {
      setView((current) => {
        const zoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM)
        if (zoom === MIN_ZOOM) return { zoom, x: 0, y: 0 }
        const oldX = originX * current.zoom + current.x
        const oldY = originY * current.zoom + current.y
        const ratio = zoom / current.zoom
        const newX = point.x - (point.x - oldX) * ratio
        const newY = point.y - (point.y - oldY) * ratio
        return { zoom, x: newX - originX * zoom, y: newY - originY * zoom }
      })
    },
    [originX, originY]
  )

  const zoomBy = (factor: number) => zoomAt(factor, { x: stageWidth / 2, y: stageHeight / 2 })

  // Przybliżenie do wskazanego stołu / krzesła (wyszukiwarka).
  useEffect(() => {
    if (!focus || baseScale === 0) return
    const table = tables.find((item) => item.id === focus.tableId)
    if (!table) return
    const geometry = tableGeometry(table.shape, table.capacity, table.seat_config)
    const seat = focus.seatNumber ? geometry.seats.find((item) => item.number === focus.seatNumber) : null
    const target = seat ? toRoomPoint(table, seat) : { x: table.x, y: table.y }
    const zoom = Math.max(view.zoom, FOCUS_ZOOM)
    const s = baseScale * zoom
    setView({
      zoom,
      x: stageWidth / 2 - target.x * s - originX * zoom,
      y: stageHeight / 2 - target.y * s - originY * zoom,
    })
    // tylko przy nowym żądaniu (nonce) - nie przy każdym przesunięciu widoku
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce, baseScale])

  // Transformer na zaznaczonym stole / elemencie tła.
  useEffect(() => {
    const transformer = transformerRef.current
    const stage = stageRef.current
    if (!transformer || !stage) return
    const node = editable && selectedId ? stage.findOne(`#${CSS.escape(selectedId)}`) : null
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [editable, selectedId, tables, landmarks])

  const selectedIsLandmark = landmarks.some((landmark) => landmark.id === selectedId)

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    if (!wheelZoom) return
    event.evt.preventDefault()
    const pointer = stageRef.current?.getPointerPosition()
    if (!pointer) return
    zoomAt(event.evt.deltaY > 0 ? 1 / 1.15 : 1.15, pointer)
  }

  const handleTouchMove = (event: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = event.evt.touches
    if (touches.length !== 2) return
    event.evt.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const [a, b] = [touches[0], touches[1]]
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const center = { x: (a.clientX + b.clientX) / 2 - rect.left, y: (a.clientY + b.clientY) / 2 - rect.top }
    if (pinchRef.current) {
      zoomAt(distance / pinchRef.current.distance, center)
    }
    pinchRef.current = { distance }
  }

  const handleStageDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    const stage = stageRef.current
    if (!stage || event.target !== stage) return
    setView((current) => ({
      ...current,
      x: stage.x() - originX * current.zoom,
      y: stage.y() - originY * current.zoom,
    }))
  }

  const handleStagePointerDown = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const target = event.target
    if (target === stageRef.current || target.name() === 'room') {
      onSelect?.(null)
    }
  }

  const showHover = (text: string | null | undefined, node: Konva.Node) => {
    if (!text) return
    const box = node.getClientRect()
    setHover({ text, left: box.x + box.width / 2, top: box.y })
  }

  const setCursor = (cursor: string) => {
    const container = stageRef.current?.container()
    if (container) container.style.cursor = cursor
  }

  const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (onGuestDrop && event.dataTransfer.types.includes(GUEST_DRAG_TYPE)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    }
  }

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    const stage = stageRef.current
    const guestId = event.dataTransfer.getData(GUEST_DRAG_TYPE)
    if (!stage || !guestId || !onGuestDrop) return
    event.preventDefault()
    stage.setPointersPositions(event.nativeEvent)
    const pointer = stage.getPointerPosition()
    const shape = pointer ? stage.getIntersection(pointer) : null
    if (shape?.name() === 'seat') {
      onGuestDrop(guestId, shape.getAttr('tableId') as string, shape.getAttr('seatNumber') as number)
    }
  }

  // Strzałki przesuwają zaznaczony stół / element, R obraca o 90°.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!editable || !selectedId) return
    const table = tables.find((item) => item.id === selectedId)
    const landmark = landmarks.find((item) => item.id === selectedId)
    const item = table ?? landmark
    if (!item) return
    const step = event.shiftKey ? 50 : GRID
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      const patch = {
        x: clamp(item.x + move[0], 0, room.width),
        y: clamp(item.y + move[1], 0, room.height),
      }
      if (table) onTableChange?.(table.id, patch)
      else onLandmarkChange?.(item.id, patch)
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault()
      const rotation = normalizeAngle(item.rotation + 90)
      if (table) onTableChange?.(table.id, { rotation })
      else onLandmarkChange?.(item.id, { rotation })
    }
  }

  const grid = useMemo(() => {
    if (!showGrid) return null
    const lines: number[][] = []
    for (let x = 100; x < room.width; x += 100) lines.push([x, 0, x, room.height])
    for (let y = 100; y < room.height; y += 100) lines.push([0, y, room.width, y])
    return lines
  }, [room.height, room.width, showGrid])

  const fontSize = (px: number) => px / scale
  const ready = baseScale > 0

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60 bg-secondary/30 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      style={fit === 'width' ? { height: ready ? stageHeight : undefined, aspectRatio: ready ? undefined : `${room.width} / ${room.height}` } : undefined}
      role="img"
      aria-label={ariaLabel}
      tabIndex={editable ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseLeave={() => setHover(null)}
    >
      {ready && (
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={stageHeight}
          scaleX={scale}
          scaleY={scale}
          x={stageX}
          y={stageY}
          draggable={editable || view.zoom > 1}
          onWheel={handleWheel}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => {
            pinchRef.current = null
          }}
          onDragEnd={handleStageDragEnd}
          onMouseDown={handleStagePointerDown}
          onTouchStart={handleStagePointerDown}
        >
          <Layer>
            <Rect
              name="room"
              x={0}
              y={0}
              width={room.width}
              height={room.height}
              fill={colors.background}
              stroke={colors.border}
              strokeWidth={fontSize(1)}
            />
            {grid?.map((points, index) => (
              <Line key={index} points={points} stroke={colors.border} strokeWidth={fontSize(0.5)} listening={false} />
            ))}

            {landmarks.map((landmark) => (
              <Group
                key={landmark.id}
                id={landmark.id}
                x={landmark.x}
                y={landmark.y}
                rotation={landmark.rotation}
                draggable={editable}
                listening={editable}
                onMouseDown={() => onSelect?.(landmark.id)}
                onTap={() => onSelect?.(landmark.id)}
                onDragEnd={(event) => {
                  onLandmarkChange?.(landmark.id, {
                    x: clamp(snap(event.target.x()), 0, room.width),
                    y: clamp(snap(event.target.y()), 0, room.height),
                  })
                }}
                onTransformEnd={(event) => {
                  const node = event.target
                  const width = clamp(Math.round(landmark.width * node.scaleX()), 20, 5000)
                  const height = clamp(Math.round(landmark.height * node.scaleY()), 20, 5000)
                  node.scale({ x: 1, y: 1 })
                  onLandmarkChange?.(landmark.id, {
                    width,
                    height,
                    rotation: normalizeAngle(node.rotation()),
                    x: clamp(snap(node.x()), 0, room.width),
                    y: clamp(snap(node.y()), 0, room.height),
                  })
                }}
              >
                <Rect
                  x={-landmark.width / 2}
                  y={-landmark.height / 2}
                  width={landmark.width}
                  height={landmark.height}
                  fill={colors.muted}
                  opacity={0.6}
                  stroke={colors.mutedForeground}
                  strokeWidth={fontSize(1)}
                  dash={[fontSize(6), fontSize(4)]}
                  cornerRadius={8}
                />
                <Text
                  text={landmark.label.toUpperCase()}
                  x={-landmark.width / 2}
                  y={-fontSize(7)}
                  width={landmark.width}
                  align="center"
                  fontSize={fontSize(12)}
                  letterSpacing={fontSize(1)}
                  fill={colors.mutedForeground}
                  listening={false}
                />
              </Group>
            ))}

            {tables.map((table) => {
              const geometry = tableGeometry(table.shape, table.capacity, table.seat_config)
              const inactive = inactiveTables?.has(table.id) ?? false
              const highlighted = highlightedTables?.has(table.id) ?? false

              return (
                <Group
                  key={table.id}
                  id={table.id}
                  x={table.x}
                  y={table.y}
                  rotation={table.rotation}
                  draggable={editable}
                  onDragStart={() => setHover(null)}
                  onDragEnd={(event) => {
                    if (event.target.id() !== table.id) return
                    onTableChange?.(table.id, {
                      x: clamp(snap(event.target.x()), 0, room.width),
                      y: clamp(snap(event.target.y()), 0, room.height),
                    })
                  }}
                  onTransformEnd={(event) => {
                    onTableChange?.(table.id, { rotation: normalizeAngle(event.target.rotation()) })
                  }}
                >
                  {geometry.blocks.map((block, index) => (
                    <Rect
                      key={index}
                      name="table"
                      x={block.x}
                      y={block.y}
                      width={block.width}
                      height={block.height}
                      fill={colors.card}
                      stroke={highlighted || selectedId === table.id ? colors.primary : colors.mutedForeground}
                      strokeWidth={fontSize(highlighted ? 3 : 1.5)}
                      cornerRadius={4}
                      onMouseDown={() => onSelect?.(table.id)}
                      onClick={() => onTableClick?.(table.id)}
                      onTap={() => {
                        onSelect?.(table.id)
                        onTableClick?.(table.id)
                      }}
                      onMouseEnter={() => setCursor(editable ? 'move' : onTableClick ? 'pointer' : 'default')}
                      onMouseLeave={() => setCursor('default')}
                    />
                  ))}

                  {geometry.seats.map((seat) => {
                    const key = seatKey(table.id, seat.number)
                    const visual = seatVisual(table.id, seat.number)
                    const isHighlighted = highlightedSeats?.has(key) ?? false
                    const isSelected = selectedSeat === key

                    return (
                      <Fragment key={seat.number}>
                        {(isHighlighted || isSelected) && (
                          <Circle
                            x={seat.x}
                            y={seat.y}
                            radius={SEAT_RADIUS + 7}
                            stroke={isSelected ? colors.foreground : colors.primary}
                            strokeWidth={4}
                            listening={false}
                          />
                        )}
                        <Circle
                          name="seat"
                          tableId={table.id}
                          seatNumber={seat.number}
                          x={seat.x}
                          y={seat.y}
                          radius={SEAT_RADIUS}
                          fill={visual.fill}
                          stroke={colors.mutedForeground}
                          strokeWidth={fontSize(1)}
                          opacity={inactive ? 0.35 : visual.dimmed ? 0.3 : 1}
                          listening={!inactive}
                          onClick={() => onSeatClick?.(table.id, seat.number)}
                          onTap={() => onSeatClick?.(table.id, seat.number)}
                          onMouseEnter={(event) => {
                            setCursor(onSeatClick ? 'pointer' : 'default')
                            showHover(visual.title, event.target)
                          }}
                          onMouseLeave={() => {
                            setCursor('default')
                            setHover(null)
                          }}
                        />
                        {visual.dot && (
                          <Circle
                            x={seat.x + SEAT_RADIUS * 0.7}
                            y={seat.y - SEAT_RADIUS * 0.7}
                            radius={7}
                            fill={visual.dot}
                            stroke={colors.background}
                            strokeWidth={2}
                            opacity={visual.dimmed ? 0.3 : 1}
                            listening={false}
                          />
                        )}
                        {visual.label && (
                          <Text
                            text={visual.label}
                            x={seat.x}
                            y={seat.y}
                            width={SEAT_RADIUS * 2}
                            height={SEAT_RADIUS * 2}
                            offsetX={SEAT_RADIUS}
                            offsetY={SEAT_RADIUS}
                            rotation={-table.rotation}
                            align="center"
                            verticalAlign="middle"
                            fontSize={16}
                            fontStyle="bold"
                            fill="#1f2937"
                            opacity={visual.dimmed ? 0.4 : 1}
                            listening={false}
                          />
                        )}
                      </Fragment>
                    )
                  })}

                  <Text
                    text={table.name}
                    x={geometry.label.x}
                    y={geometry.label.y}
                    width={fontSize(240)}
                    offsetX={fontSize(120)}
                    offsetY={fontSize(7)}
                    wrap="none"
                    rotation={-table.rotation}
                    align="center"
                    fontSize={fontSize(13)}
                    fontStyle="bold"
                    fill={colors.foreground}
                    listening={false}
                  />
                </Group>
              )
            })}

            {editable && (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                resizeEnabled={selectedIsLandmark}
                keepRatio={false}
                rotationSnaps={Array.from({ length: 24 }, (_, index) => index * 15)}
                rotationSnapTolerance={4}
                enabledAnchors={
                  selectedIsLandmark
                    ? ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']
                    : []
                }
                borderStroke={colors.primary}
                anchorStroke={colors.primary}
                flipEnabled={false}
                ignoreStroke
              />
            )}
          </Layer>
        </Stage>
      )}

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background shadow"
          style={{ left: hover.left, top: hover.top - 4 }}
          role="presentation"
        >
          {hover.text}
        </div>
      )}

      <div className="absolute right-2 bottom-2 flex flex-col gap-1">
        <Button type="button" size="icon" variant="outline" className="size-8 bg-background/90" aria-label="Przybliż plan" onClick={() => zoomBy(1.4)}>
          <Plus className="size-4" />
        </Button>
        <Button type="button" size="icon" variant="outline" className="size-8 bg-background/90" aria-label="Oddal plan" onClick={() => zoomBy(1 / 1.4)}>
          <Minus className="size-4" />
        </Button>
        <Button type="button" size="icon" variant="outline" className="size-8 bg-background/90" aria-label="Pokaż całą salę" onClick={resetView}>
          <Maximize2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
