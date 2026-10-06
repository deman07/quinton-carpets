-- Quinton Carpets — the placeholder content, for a new database.
--
-- Every range name, guide price and rate below is a PLACEHOLDER. The
-- shop replaces them in the Supabase Table Editor (ranges, rates and
-- settings), and the site picks the change up within about a minute.
--
-- Run by `npm run db:setup` after schema.sql. Every insert is
-- ON CONFLICT DO NOTHING, so running it again adds anything missing
-- and never writes over an edit.

-- The 14 placeholder ranges. Photos are stock pictures of the right
-- material, kept in public/ranges/; the underlays have none and show
-- their texture instead.
INSERT INTO ranges
  (id, name, material, spec, price, grade, rooms, widths, pile, colours,
   photo_url, sort_order, showcase, description)
VALUES
  ('hagley-twist', 'Hagley Twist', 'Carpet', '80/20 wool-rich twist pile', 24.99, 'Heavy domestic · Class 23', ARRAY['Living', 'Bedroom', 'Stairs']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#B8AE9C', '#8E8474', '#6B6355']::text[], '/ranges/hagley-twist.jpg', 1, 1, 'The one most people end up with. A wool-rich twist takes a hoover and a hallway without flattening off, and the 80/20 blend keeps its colour where the light lands.'),
  ('ridgacre-saxony', 'Ridgacre Saxony', 'Carpet', 'Deep polypropylene saxony', 17.99, 'General domestic · Class 22', ARRAY['Living', 'Bedroom']::text[], ARRAY[4, 5]::double precision[], 'saxony', ARRAY['#D8CFC0', '#B3A895']::text[], '/ranges/ridgacre-saxony.jpg', 2, NULL, 'Deep and soft underfoot, and polypropylene means you can get most things out of it with a damp cloth. Best in a bedroom or a lounge rather than a hall.'),
  ('woodgate-loop', 'Woodgate Loop', 'Carpet', 'Natural wool-rich loop', 29.99, 'Heavy domestic · Class 23', ARRAY['Living', 'Hall', 'Stairs']::text[], ARRAY[4, 5]::double precision[], 'loop', ARRAY['#C9BFA8', '#9A8F76']::text[], '/ranges/woodgate-loop.jpg', 3, 5, 'A loop pile holds its shape in a busy hall better than anything else we sell. Worth knowing: if you have a cat, a loop is the one to avoid.'),
  ('bartley-berber', 'Bartley Berber', 'Carpet', 'Stain-resistant berber twist', 14.99, 'General domestic · Class 22', ARRAY['Bedroom', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#CFC7B6', '#A69C86']::text[], '/ranges/bartley-berber.jpg', 4, NULL, 'The sensible choice for a first house or a rental. Flecked, so it hides a multitude, and the stain treatment is built into the fibre rather than sprayed on.'),
  ('quinton-heather', 'Quinton Heather', 'Carpet', 'Heathered twist, 50oz', 21.99, 'Heavy domestic · Class 23', ARRAY['Living', 'Stairs', 'Bedroom']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#8D8B91', '#63616A']::text[], '/ranges/quinton-heather.jpg', 5, 2, '50oz is a heavy carpet — you can feel it in the roll. The heathered yarn gives it depth on a staircase where a flat colour would show every tread.'),
  ('nailers-felt-back', 'Nailers Felt-back', 'Carpet', 'Felt-back cord, fitter''s favourite', 8.99, 'Light domestic · Class 21', ARRAY['Bedroom', 'Hall']::text[], ARRAY[4]::double precision[], 'loop', ARRAY['#B7B2A6', '#8F8A7D']::text[], '/ranges/nailers-felt-back.jpg', 6, NULL, 'Felt-back goes down without underlay or gripper, so it is quick and it is cheap. A box room, a landing, a house you are selling.'),
  ('halesowen-stripe', 'Halesowen Stripe', 'Carpet', 'Flatweave stripe, wool blend', 26.99, 'Heavy domestic · Class 23', ARRAY['Hall', 'Stairs']::text[], ARRAY[4]::double precision[], 'stripe', ARRAY['#2F2C28', '#C8BEA9']::text[], '/ranges/halesowen-stripe.jpg', 7, NULL, 'Stripes want planning on a staircase — the pattern has to run true up every riser, which is why we measure before we cut. Only comes on a 4m roll.'),
  ('wolverley-oak', 'Wolverley Oak 8mm', 'Laminate', 'AC4 laminate, click fit', 19.99, 'Commercial · Class 32', ARRAY['Living', 'Kitchen', 'Hall']::text[], NULL, 'plank', ARRAY['#C69B63', '#9A733F']::text[], '/ranges/wolverley-oak.jpg', 8, 3, 'AC4 is rated for commercial use, so a family hallway is nothing to it. Click fit over a combi board, with a 10mm expansion gap under the skirting.'),
  ('ridgeway-grey', 'Ridgeway Grey 12mm', 'Laminate', 'AC5, water-resistant core', 27.99, 'Commercial · Class 33', ARRAY['Kitchen', 'Hall', 'Living']::text[], NULL, 'plank', ARRAY['#A9A49C', '#7E7972']::text[], '/ranges/ridgeway-grey.jpg', 9, NULL, '12mm and AC5, with a core that will take a spilled washing machine without swelling at the joints. The thickness is what stops it sounding hollow.'),
  ('lapal-vinyl', 'Lapal Cushioned Vinyl', 'Vinyl', 'Cushioned sheet vinyl', 12.99, 'General domestic', ARRAY['Kitchen', 'Bathroom']::text[], ARRAY[3, 4]::double precision[], 'sheet', ARRAY['#DCD6CB', '#B6AEA0']::text[], '/ranges/lapal-vinyl.jpg', 10, NULL, 'Sheet vinyl comes off 3m and 4m rolls, so a bathroom usually goes down in one piece with no seam. Warm underfoot because of the cushioned backing.'),
  ('californian-herringbone', 'Californian Herringbone', 'Vinyl', 'Luxury vinyl tile, click', 34.99, 'Commercial · Class 33', ARRAY['Kitchen', 'Hall', 'Living']::text[], NULL, 'herring', ARRAY['#B78A55', '#8C6435']::text[], '/ranges/californian-herringbone.jpg', 11, 4, 'The best-looking floor in the shop, and the one that takes longest to lay — a herringbone is set out from the centre line, not from a wall.'),
  ('pu-comfort', '8mm PU Comfort', 'Underlay', '8mm polyurethane · 2.1 tog', 4.5, 'For carpet', ARRAY['Living', 'Bedroom', 'Stairs']::text[], NULL, 'foam', ARRAY['#6FAF8E', '#4E8C6C']::text[], NULL, 12, NULL, 'What we put under most carpets. 2.1 tog, so it holds the heat in, and it takes the drum out of a suspended timber floor.'),
  ('pu-luxury', '11mm PU Luxury', 'Underlay', '11mm polyurethane · 2.6 tog', 7.5, 'For carpet', ARRAY['Living', 'Bedroom']::text[], NULL, 'foam', ARRAY['#7FA8CF', '#5C86AD']::text[], NULL, 13, NULL, 'Three more millimetres than you think you need, and the difference is obvious the first time you walk on it. Not for stairs — too much give on a nosing.'),
  ('combi-board', 'Combi Board 6mm', 'Underlay', 'Foam & foil, for laminate and LVT', 3.2, 'For hard floors', ARRAY['Kitchen', 'Hall', 'Living']::text[], NULL, 'foam', ARRAY['#C9C3B4', '#A49D8C']::text[], NULL, 14, NULL, 'Foam one side, foil the other. The foil is the damp-proof membrane, which is not optional on a concrete floor.')
ON CONFLICT (id) DO NOTHING;

-- Placeholder fitting rates, pending the shop's real ones. These are
-- the same figures as PRICES in src/lib/pricing.ts, which the unit
-- tests use.
INSERT INTO rates
  (id, fit_carpet, fit_hard, fit_stair, uplift, gripper, doorbar, furniture,
   trim, wastage_hard, underlay_allowance, stair_area)
VALUES
  (1, 5.5, 9.5, 8.0, 2.2, 2.6, 14.0, 35.0, 0.1, 1.1, 1.05, 0.85)
ON CONFLICT (id) DO NOTHING;

-- The settings row, with every column at its default.
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
