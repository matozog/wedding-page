export const createThumbnail = (
  file: File,
  maxSize = 800,
  quality = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const scale = Math.min(
        1,
        maxSize / image.width,
        maxSize / image.height
      )

      const width = Math.round(image.width * scale)
      const height = Math.round(image.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Nie można utworzyć canvas.'))
        return
      }

      ctx.drawImage(image, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Nie można utworzyć miniatury.'))
            return
          }

          resolve(blob)
        },
        'image/jpeg',
        quality
      )
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Nie można odczytać zdjęcia.'))
    }

    image.src = objectUrl
  })
}
