ALTER TABLE public.rooms ADD COLUMN mode text NOT NULL DEFAULT 'music';
ALTER TABLE public.rooms ADD CONSTRAINT rooms_mode_check CHECK (mode IN ('music','screen','mixed'));

ALTER TABLE public.rounds ADD COLUMN kind text NOT NULL DEFAULT 'music';
ALTER TABLE public.rounds ADD CONSTRAINT rounds_kind_check CHECK (kind IN ('music','screen'));

CREATE TABLE public.titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itunes_id text NOT NULL UNIQUE,
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  preview_url text NOT NULL,
  artwork_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.titles TO service_role;
ALTER TABLE public.titles ENABLE ROW LEVEL SECURITY;

CREATE INDEX titles_media_type_idx ON public.titles (media_type);