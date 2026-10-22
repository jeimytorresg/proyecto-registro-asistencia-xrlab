INSERT INTO careers (name)
VALUES
  ('Computación'),
  ('Tecnologías de la Información'),
  ('Telecomunicaciones')
ON CONFLICT (name) DO NOTHING;

INSERT INTO practice_types (name)
VALUES
  ('Práctica de laboratorio'),
  ('Proyecto de investigación'),
  ('Vinculación')
ON CONFLICT (name) DO NOTHING;

INSERT INTO kiosks (code, name, location, active)
VALUES
  ('XR-KIOSK-01', 'Kiosko principal XRLAB', 'Laboratorio XRLAB', TRUE)
ON CONFLICT (code)
DO UPDATE SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  active = EXCLUDED.active,
  updated_at = now();

INSERT INTO academic_periods (name, start_date, end_date, is_active)
VALUES
  ('Periodo piloto 2026', DATE '2026-05-07', DATE '2026-06-17', TRUE)
ON CONFLICT (name)
DO UPDATE SET
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  is_active = EXCLUDED.is_active,
  updated_at = now();
