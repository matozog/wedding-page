SET local check_function_bodies = off;

CREATE TABLE "public"."events" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"             text                     NOT NULL,
  "access_code_hash" text                     NOT NULL,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "events_access_code_hash_key" UNIQUE (access_code_hash),
  CONSTRAINT "events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."guest_sessions" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid                     NOT NULL,
  "event_id"   uuid                     NOT NULL,
  "nickname"   text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "guest_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "guest_sessions_user_id_event_id_key" UNIQUE (user_id, event_id)
);

ALTER TABLE "public"."guest_sessions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."photos" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "event_id"               uuid                     NOT NULL,
  "guest_session_id"       uuid                     NOT NULL,
  "storage_path"           text                     NOT NULL,
  "original_filename"      text                     NOT NULL,
  "mime_type"              text                     NOT NULL,
  "size_bytes"             bigint                   NOT NULL,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "thumbnail_storage_path" text,
  CONSTRAINT "photos_pkey" PRIMARY KEY (id),
  CONSTRAINT "photos_storage_path_key" UNIQUE (storage_path)
);

ALTER TABLE "public"."photos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."user_roles" (
  "user_id" uuid NOT NULL,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "public"."user_roles"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."app_role" AS ENUM (
  'ADMIN',
  'EDITOR',
  'GUEST'
);

ALTER TABLE "public"."user_roles"
  ADD COLUMN "role" public.app_role NOT NULL DEFAULT 'GUEST'::public.app_role;

ALTER TABLE "public"."user_roles"
  ADD COLUMN "email" text;

ALTER TABLE "public"."user_roles"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.create_event (
  event_name  text,
  access_code text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
  AS $function$
declare
  new_event_id uuid;
begin
  insert into public.events (
    name,
    access_code_hash
  )
  values (
    event_name,
    extensions.crypt(access_code, extensions.gen_salt('bf'))
  )
  returning id into new_event_id;

  return new_event_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.current_app_role()
  RETURNS public.app_role
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid()),
    'GUEST'::public.app_role
  );
$function$;

CREATE OR REPLACE FUNCTION public.handle_google_identity()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.user_roles (user_id, role, email)
  values (new.user_id, 'GUEST', new.identity_data ->> 'email')
  on conflict (user_id) do update
    set email = excluded.email;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_my_event (
  p_event_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.guest_sessions gs
    where gs.event_id = p_event_id
      and gs.user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_my_guest_session (
  p_guest_session_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.guest_sessions
    where id = p_guest_session_id
      and user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.join_event (
  p_input_code text
)
  RETURNS TABLE (
    id               uuid,
    name             text,
    guest_session_id uuid
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
  AS $function$
declare
  v_event_id uuid;
  v_event_name text;
  v_guest_session_id uuid;
begin
  select
    e.id,
    e.name
  into
    v_event_id,
    v_event_name
  from public.events e
  where extensions.crypt(
    p_input_code,
    e.access_code_hash
  ) = e.access_code_hash
  limit 1;

  if v_event_id is null then
    return;
  end if;

  insert into public.guest_sessions (
    user_id,
    event_id
  )
  values (
    auth.uid(),
    v_event_id
  )
  on conflict (user_id, event_id)
  do nothing;

  select gs.id
  into v_guest_session_id
  from public.guest_sessions gs
  where gs.user_id = auth.uid()
    and gs.event_id = v_event_id;

  return query
  select
    v_event_id,
    v_event_name,
    v_guest_session_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_nickname (
  input_nickname text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  update public.guest_sessions
  set nickname = trim(input_nickname)
  where user_id = auth.uid();

  if not found then
    raise exception 'Guest session not found';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.verify_event_code (
  input_code text
)
  RETURNS TABLE (
    event_id   uuid,
    event_name text
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
  AS $function$
  select
    e.id,
    e.name
  from public.events e
  where extensions.crypt(
    input_code,
    e.access_code_hash
  ) = e.access_code_hash
  limit 1;
$function$;

ALTER TABLE "public"."guest_sessions"
  ADD CONSTRAINT "guest_sessions_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE "public"."guest_sessions"
  ADD CONSTRAINT "guest_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."photos"
  ADD CONSTRAINT "photos_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE "public"."photos"
  ADD CONSTRAINT "photos_guest_session_id_fkey" FOREIGN KEY (guest_session_id) REFERENCES public.guest_sessions(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_roles"
  ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE TRIGGER on_google_identity_linked
  AFTER INSERT ON auth.identities
  FOR EACH ROW
  WHEN ((new.provider = 'google'::text))
  EXECUTE FUNCTION public.handle_google_identity();

CREATE POLICY "Users can update their own guest session" ON "public"."guest_sessions"
  FOR UPDATE
  TO "authenticated"
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Editors and admins can delete photos" ON "public"."photos"
  FOR DELETE
  TO "authenticated"
  USING ((public.current_app_role() = ANY (ARRAY['ADMIN'::public.app_role, 'EDITOR'::public.app_role])));

CREATE POLICY "Guests can create their own photos" ON "public"."photos"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (public.is_my_guest_session(guest_session_id));

CREATE POLICY "Guests can view photos from their event" ON "public"."photos"
  FOR SELECT
  TO "authenticated"
  USING (public.is_my_event(event_id));

CREATE POLICY "Users can view their own role" ON "public"."user_roles"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "Editors and admins can delete photo files" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'photos'::text) AND (public.current_app_role() = ANY (ARRAY['ADMIN'::public.app_role, 'EDITOR'::public.app_role]))));

CREATE POLICY "Guests can upload to their event" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'photos'::text) AND public.is_my_event(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Guests can view photos from their event" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'photos'::text) AND public.is_my_event(((storage.foldername(name))[1])::uuid)));

GRANT EXECUTE ON FUNCTION "public"."create_event"(text, text) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."create_event"(text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_event"(text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_event"(text, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."current_app_role"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."current_app_role"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."current_app_role"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."current_app_role"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."handle_google_identity"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."handle_google_identity"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_google_identity"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_google_identity"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."is_my_event"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."is_my_event"(uuid) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."is_my_event"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_my_event"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_my_event"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."is_my_guest_session"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."is_my_guest_session"(uuid) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."is_my_guest_session"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_my_guest_session"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_my_guest_session"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."join_event"(text) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."join_event"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."join_event"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."join_event"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_nickname"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."set_nickname"(text) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."set_nickname"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_nickname"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_nickname"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."verify_event_code"(text) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."verify_event_code"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."verify_event_code"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."verify_event_code"(text) TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."events" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."guest_sessions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."guest_sessions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."guest_sessions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."guest_sessions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."photos" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."photos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."photos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."photos" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_roles" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."user_roles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_roles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_roles" TO "service_role";

