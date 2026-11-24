-- Quinton Carpets — the starting content, for a new database.
--
-- The Cormar carpets are real. Every other range name, guide price and
-- rate below is a PLACEHOLDER. The
-- shop replaces them in the Supabase Table Editor (ranges, rates and
-- settings), and the site picks the change up within about a minute.
--
-- Run by `npm run db:setup` after schema.sql. Every insert is
-- ON CONFLICT DO NOTHING, so running it again adds anything missing
-- and never writes over an edit.

-- The 14 starting ranges. Photos are kept in public/ranges/ and
-- public/site/; the shop can replace them in the ranges table.
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
  ('lapal-vinyl', 'Lapal Cushioned Vinyl', 'Vinyl', 'Cushioned sheet vinyl', 12.99, 'General domestic', ARRAY['Kitchen', 'Bathroom']::text[], ARRAY[3, 4]::double precision[], 'sheet', ARRAY['#DCD6CB', '#B6AEA0']::text[], '/ranges/lapal-vinyl.jpg', 10, NULL, 'Sheet vinyl comes off 3m and 4m rolls, so a bathroom usually goes down in one piece with no seam. Warm underfoot because of the cushioned backing.'),
  ('californian-herringbone', 'Californian Herringbone', 'Vinyl', 'Luxury vinyl tile, click', 34.99, 'Commercial · Class 33', ARRAY['Kitchen', 'Hall', 'Living']::text[], NULL, 'herring', ARRAY['#B78A55', '#8C6435']::text[], '/ranges/californian-herringbone.jpg', 11, 4, 'The best-looking floor in the shop, and the one that takes longest to lay — a herringbone is set out from the centre line, not from a wall.'),
  ('pu-comfort', 'Standard 10mm', 'Underlay', '10mm cushioned PU foam', 4.99, 'For carpet', ARRAY['Living', 'Bedroom', 'Stairs']::text[], NULL, 'foam', ARRAY['#B9B0A1', '#8E877B']::text[], NULL, 12, NULL, 'A practical 10mm foam underlay that adds cushioning, warmth and everyday noise reduction beneath carpet.'),
  ('pu-luxury', 'Dreamwalk 11mm', 'Underlay', '11mm PU foam · 3.13 tog', 6.99, 'For carpet', ARRAY['Living', 'Bedroom']::text[], NULL, 'foam', ARRAY['#A9B4C2', '#7D8898']::text[], '/site/underlay-dreamwalk.jpg', 13, NULL, 'Part of Tredaire''s Premier range and one of the thickest carpet underlays made. Dense 11mm PU foam gives a soft, long-lasting cushion, and its high tog rating keeps heat in and noise out. Ideal for bedrooms, living rooms and lounges.'),
  ('dreamwalk-9', 'Dreamwalk 9mm', 'Underlay', '9mm premium PU foam', 5.99, 'For carpet', ARRAY['Living', 'Bedroom', 'Stairs']::text[], NULL, 'foam', ARRAY['#8EAD9C', '#5D806F']::text[], NULL, 14, NULL, 'The slightly slimmer Dreamwalk option, giving carpet a comfortable, durable base while helping with warmth and sound.'),
  ('cumulus-11', 'Cumulus Cloud 9 11mm', 'Underlay', '11mm Cloud 9 PU foam', 7.99, 'For carpet', ARRAY['Living', 'Bedroom']::text[], NULL, 'foam', ARRAY['#C7B79E', '#927C61']::text[], '/site/underlay-cumulus.jpg', 15, NULL, 'A luxury Cloud 9 underlay with a deep, resilient foam cushion for comfort, insulation and a quieter room.'),
  ('cumulus-9', 'Cumulus Cloud 9 9mm', 'Underlay', '9mm Cloud 9 PU foam', 6.99, 'For carpet', ARRAY['Living', 'Bedroom', 'Stairs']::text[], NULL, 'foam', ARRAY['#B8A58E', '#806B54']::text[], '/site/underlay-cirrus.jpg', 16, NULL, 'A 9mm Cloud 9 foam underlay that balances a softer step with reliable support beneath everyday carpet.'),
  ('combi-board', 'Combi Board 6mm', 'Underlay', 'Foam & foil, for laminate and LVT', 3.2, 'For hard floors', ARRAY['Kitchen', 'Hall', 'Living']::text[], NULL, 'foam', ARRAY['#C9C3B4', '#A49D8C']::text[], NULL, 14, NULL, 'Foam one side, foil the other. The foil is the damp-proof membrane, which is not optional on a concrete floor.')
ON CONFLICT (id) DO NOTHING;

-- Laminate is no longer part of the customer-facing range catalogue.
DELETE FROM ranges WHERE id IN ('wolverley-oak', 'ridgeway-grey');

-- Keep an existing database in step with the underlay prices and copy
-- above. The seed insert is intentionally non-destructive for other edits.
UPDATE ranges SET
  name = 'Standard 10mm',
  spec = '10mm cushioned PU foam',
  price = 4.99,
  description = 'A practical 10mm foam underlay that adds cushioning, warmth and everyday noise reduction beneath carpet.'
WHERE id = 'pu-comfort';

UPDATE ranges SET
  name = 'Dreamwalk 11mm',
  spec = '11mm PU foam · 3.13 tog',
  price = 6.99,
  brand = 'Tredaire',
  category = 'Premier Range',
  colours = ARRAY['#A9B4C2', '#7D8898']::text[],
  photo_url = '/site/underlay-dreamwalk.jpg',
  features = ARRAY[
    '3.13 tog, highly insulating',
    '44dB impact sound reduction',
    '110kg/m³ density PU foam',
    'Stretch fit (not for double-stick)',
    'Guaranteed for the life of the carpet'
  ]::text[],
  description = 'Part of Tredaire''s Premier range and one of the thickest carpet underlays made. Dense 11mm PU foam gives a soft, long-lasting cushion, and its high tog rating keeps heat in and noise out. Ideal for bedrooms, living rooms and lounges.'
WHERE id = 'pu-luxury';

-- The shop's real carpet ranges, from Cormar, with Cormar's own "from"
-- prices per m², supply only. Photos are Cormar's, kept in
-- public/ranges/cormar/; each links to Cormar's free-sample page.
--
-- The first time these go in, the seven placeholder carpets above are
-- hidden (active = false, out of the home banner) — the Cormar ranges
-- replace them. That only happens on the run that inserts the Cormar
-- rows, so a placeholder the shop switches back on stays on.
WITH added AS (
  INSERT INTO ranges
    (id, name, material, spec, price, grade, rooms, widths, pile, colours,
     photo_url, sort_order, showcase, description,
     brand, category, features, colour_names, sample_url, price_from)
  VALUES
  ('apollo-elite', 'Apollo Elite', 'Carpet', '100% Excellon polypropylene', 25, 'Heavy domestic', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#BFB59B', '#958D79']::text[], '/ranges/cormar/apollo-elite.jpg', 1, NULL, 'A practical easy-clean carpet from Cormar''s Apollo collection, made for busy homes.', 'Cormar', 'Easy Clean', ARRAY['Easy clean', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Dolomite Stone', 'Pale Angora']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/easy-clean/apollo-elite/variants/pale-angora/', true),
  ('apollo-plus', 'Apollo Plus', 'Carpet', '100% Excellon polypropylene', 20, 'Heavy domestic', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#C1B39E', '#968B7B']::text[], '/ranges/cormar/apollo-plus.jpg', 1, NULL, 'An easy-clean, hard-wearing carpet designed for everyday family living.', 'Cormar', 'Easy Clean', ARRAY['Easy clean', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Sea Breeze', 'Shortbread']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/easy-clean/apollo-plus/variants/shortbread/', true),
  ('aurora', 'Aurora', 'Carpet', '100% Esterelle polyester', 30, 'Heavy domestic', ARRAY['Living', 'Bedroom', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'saxony', ARRAY['#DCD8CE', '#ACA9A0']::text[], '/ranges/cormar/aurora.jpg', 1, NULL, 'A soft deep-pile polyester carpet with a comfortable feel and easy-clean finish.', 'Cormar', 'Soft Deep Pile', ARRAY['Soft deep pile', 'Bleach cleanable', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Champagne', 'Linen']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/soft-deep-pile/aurora/variants/linen/', true),
  ('fairisle', 'Fairisle', 'Carpet', '100% Pure New Wool', 45, 'Extra heavy domestic / medium contract', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'loop', ARRAY['#BAAB94', '#918574']::text[], '/ranges/cormar/fairisle.jpg', 1, NULL, 'A pure new wool loop carpet in a versatile palette of natural shades.', 'Cormar', 'Wool Loop', ARRAY['Loop pile']::text[], ARRAY['Boardwalk', 'Oatflake']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/wool-loop/fairisle/variants/oatflake/', true),
  ('hampstead', 'Hampstead', 'Carpet', 'Wool twist', 40, 'Extra heavy domestic', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#B9AFA4', '#908880']::text[], '/ranges/cormar/hampstead.jpg', 1, 1, 'A durable wool twist carpet with a softly textured finish for high-use rooms.', 'Cormar', 'Wool Twist', ARRAY['Moth resistant wool']::text[], ARRAY['Pacific Pearl', 'Spirit Glow']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/wool-twist/hampstead/variants/spirit-glow/', true),
  ('inglewood-saxony', 'Inglewood Saxony', 'Carpet', '100% Excellon polypropylene', 25, 'Extra heavy domestic', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'saxony', ARRAY['#988B7C', '#776D60']::text[], '/ranges/cormar/inglewood-saxony.jpg', 1, 2, 'A plush easy-clean saxony carpet for rooms where softness and resilience both matter.', 'Cormar', 'Easy Clean', ARRAY['Saxony pile', 'Bleach cleanable', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Ganache', 'Venetian Marble']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/easy-clean/inglewood-saxony/variants/ganache/', true),
  ('kingston', 'Kingston', 'Carpet', '100% Excellon polypropylene', 20, 'Heavy domestic', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#AC9A82', '#867865']::text[], '/ranges/cormar/kingston.jpg', 1, NULL, 'A stain-resistant easy-clean carpet for busy family rooms and bedrooms.', 'Cormar', 'Easy Clean', ARRAY['Stain resistant', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Caracal', 'Skiddaw Slate']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/easy-clean/kingston/variants/caracal/', true),
  ('linwood', 'Linwood', 'Carpet', '100% Excellon polypropylene', 25, 'Heavy domestic', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#958677', '#74695D']::text[], '/ranges/cormar/linwood.jpg', 1, NULL, 'A versatile easy-clean carpet with stain resistance and a broad neutral palette.', 'Cormar', 'Easy Clean', ARRAY['Stain resistant', 'Bleach cleanable', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Cappuccino', 'Impala']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/easy-clean/linwood/variants/cappuccino/', true),
  ('malabar-two-fold', 'Malabar Two Fold', 'Carpet', '100% Pure New Wool', 40, 'Extra heavy domestic / medium contract', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'loop', ARRAY['#C6B79B', '#9B8E79']::text[], '/ranges/cormar/malabar-two-fold.jpg', 1, 5, 'A pure new wool loop carpet with a natural, textured character.', 'Cormar', 'Wool Loop', ARRAY['Loop pile']::text[], ARRAY['Cottonwood', 'Oatmeal']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/wool-loop/malabar-two-fold/variants/cottonwood/', true),
  ('natural-berber-twist', 'Natural Berber Twist', 'Carpet', 'Wool twist', 40, 'Extra heavy domestic', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#C4A887', '#99836A']::text[], '/ranges/cormar/natural-berber-twist.jpg', 1, NULL, 'A natural-looking wool twist with the flecked character of a classic Berber carpet.', 'Cormar', 'Wool Twist', ARRAY['10 Year Wear Resistance Guarantee']::text[], ARRAY['Chamois', 'Parchment']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/wool-twist/natural-berber-twist/variants/chamois/', true),
  ('pembroke', 'Pembroke', 'Carpet', 'Wool twist', 35, 'Extra heavy domestic / medium contract', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#C4B191', '#998A71']::text[], '/ranges/cormar/pembroke.jpg', 1, NULL, 'A resilient wool twist carpet in understated shades for the whole home.', 'Cormar', 'Wool Twist', ARRAY['10 Year Wear Resistance Guarantee']::text[], ARRAY['Caraway', 'Egyptian Cotton']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/wool-twist/pembroke/variants/caraway/', true),
  ('pimlico', 'Pimlico', 'Carpet', 'Wool loop', 35, 'Extra heavy domestic / medium contract', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'loop', ARRAY['#C0B4A1', '#968C7D']::text[], '/ranges/cormar/pimlico.jpg', 1, NULL, 'A hard-wearing wool loop carpet with a calm, natural appearance.', 'Cormar', 'Wool Loop', ARRAY['Moth resistant wool', '10 Year Wear Resistance Guarantee']::text[], ARRAY['Calico', 'Oyster']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/wool-loop/pimlico/variants/oyster/', true),
  ('pimlico-stripe', 'Pimlico Stripe', 'Carpet', 'Wool loop stripe', 35, 'Extra heavy domestic', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4]::double precision[], 'stripe', ARRAY['#BAB1A6', '#918A81']::text[], '/ranges/cormar/pimlico-stripe.jpg', 1, NULL, 'A classic striped wool loop carpet for stairs, halls and rooms with character.', 'Cormar', 'Wool Loop', ARRAY['Moth resistant wool', '10 Year Wear Resistance Guarantee']::text[], ARRAY['Dulwich Stripe']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/wool-loop/pimlico-stripe/variants/dulwich-stripe/', true),
  ('primo-grande', 'Primo Grande', 'Carpet', '100% Excellon polypropylene', 30, 'Heavy domestic', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#B09D88', '#897A6A']::text[], '/ranges/cormar/primo-grande.jpg', 1, NULL, 'A soft, easy-clean carpet with a generous pile and everyday family durability.', 'Cormar', 'Easy Clean', ARRAY['Stain resistant', 'Bleach cleanable', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Cloudy Bay', 'String']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/easy-clean/primo-grande/variants/string/', true),
  ('primo-naturals', 'Primo Naturals', 'Carpet', '100% Excellon polypropylene', 20, 'Heavy domestic', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#AB9176', '#85715C']::text[], '/ranges/cormar/primo-naturals.jpg', 1, NULL, 'A natural-toned easy-clean carpet designed for relaxed everyday interiors.', 'Cormar', 'Easy Clean', ARRAY['Stain resistant', 'Bleach cleanable', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Brioche', 'Sandstone']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/easy-clean/primo-naturals/variants/sandstone/', true),
  ('primo-plus', 'Primo Plus', 'Carpet', '100% Excellon polypropylene', 20, 'Heavy domestic', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#BFAF98', '#958877']::text[], '/ranges/cormar/primo-plus.jpg', 1, NULL, 'A popular easy-clean carpet offering practical family performance and soft texture.', 'Cormar', 'Easy Clean', ARRAY['Stain resistant', 'Bleach cleanable', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Cloudy Bay', 'Cotswold Clay']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/easy-clean/primo-plus/variants/cloudy-bay/', true),
  ('primo-textures', 'Primo Textures', 'Carpet', '100% Excellon polypropylene', 25, 'Heavy domestic / medium contract', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'loop', ARRAY['#CABCA4', '#9E9380']::text[], '/ranges/cormar/primo-textures.jpg', 1, NULL, 'A textured easy-clean loop carpet with a contemporary, practical finish.', 'Cormar', 'Easy Clean Loop', ARRAY['Easy clean loop', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Pale Linen']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/easy-clean-loop/primo-textures/variants/pale-linen/', true),
  ('primo-tweeds', 'Primo Tweeds', 'Carpet', '100% Excellon polypropylene', 25, 'Extra heavy domestic / medium contract', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#BCAE99', '#928878']::text[], '/ranges/cormar/primo-tweeds.jpg', 1, NULL, 'A tweed-effect easy-clean carpet that brings texture and durability to busy rooms.', 'Cormar', 'Easy Clean', ARRAY['Stain resistant', 'Bleach cleanable', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Malibu', 'Moccasin']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/easy-clean/primo-tweeds/variants/malibu/', true),
  ('primo-ultra', 'Primo Ultra', 'Carpet', '100% Excellon polypropylene', 30, 'Heavy domestic', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#B7A897', '#8E8376']::text[], '/ranges/cormar/primo-ultra.jpg', 1, NULL, 'A durable easy-clean carpet for everyday use throughout the home.', 'Cormar', 'Easy Clean', ARRAY['Easy clean', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Doeskin', 'Nougat']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/easy-clean/primo-ultra/variants/doeskin/', true),
  ('riva', 'Riva', 'Carpet', '100% Excellon polypropylene', 25, 'Extra heavy domestic', ARRAY['Living', 'Bedroom', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'saxony', ARRAY['#CDC6B7', '#A09B8E']::text[], '/ranges/cormar/riva.jpg', 1, NULL, 'A soft deep-pile easy-clean carpet with a luxurious feel for rooms throughout the home.', 'Cormar', 'Soft Deep Pile', ARRAY['Deep pile', 'Easy clean', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Arcadia']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/soft-deep-pile/riva/variants/arcadia/', true),
  ('sensation', 'Sensation', 'Carpet', '100% Luxelle polypropylene', 30, 'Heavy domestic / medium contract', ARRAY['Living', 'Bedroom', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'saxony', ARRAY['#AEA18F', '#887D6F']::text[], '/ranges/cormar/sensation.jpg', 1, NULL, 'A soft, deep-pile carpet with a rich underfoot feel and broad domestic appeal.', 'Cormar', 'Soft Deep Pile', ARRAY['Deep pile', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Latte', 'Ventura Opal']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/soft-deep-pile/sensation/variants/ventura-opal/', true),
  ('silken-serenity', 'Silken Serenity', 'Carpet', '100% Luxura polypropylene', 25, 'Extra heavy domestic / medium contract', ARRAY['Living', 'Bedroom', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'saxony', ARRAY['#B6A695', '#8E8274']::text[], '/ranges/cormar/silken-serenity.jpg', 1, NULL, 'A luxury twist-pile carpet with stain resistance and a softly textured finish.', 'Cormar', 'Soft Deep Pile', ARRAY['Deep pile', 'Stain resistant', 'Bleach cleanable', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Blyth Barley', 'County Cream']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/soft-deep-pile/silken-serenity/variants/blyth-barley/', true),
  ('trilogy', 'Trilogy', 'Carpet', '100% Pure New Wool', 45, 'Extra heavy domestic / medium contract', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'loop', ARRAY['#C7B292', '#9B8B72']::text[], '/ranges/cormar/trilogy.jpg', 1, NULL, 'A pure new wool loop collection with neutral shades and durable everyday performance.', 'Cormar', 'Wool Loop', ARRAY['Loop pile', 'Moth resistant wool', '10 Year Wear Resistance Guarantee']::text[], ARRAY['Austen 224', 'Collins 354']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/wool-loop/trilogy/variants/austen-224/', true),
  ('trinity', 'Trinity', 'Carpet', '100% Excellon polypropylene', 30, 'Extra heavy domestic / medium contract', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#BFA88D', '#95836E']::text[], '/ranges/cormar/trinity.jpg', 1, NULL, 'A stain-resistant, bleach-cleanable twist carpet in softly heathered shades.', 'Cormar', 'Easy Clean', ARRAY['Stain resistant', 'Bleach cleanable', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Marshmallow', 'Scandinavian Stone']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/easy-clean/trinity/variants/marshmallow/', true),
  ('woodland-heather-twist', 'Woodland Heather Twist', 'Carpet', 'Wool twist', 35, 'Extra heavy domestic', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#B39F8C', '#8C7C6D']::text[], '/ranges/cormar/woodland-heather-twist.jpg', 1, NULL, 'A durable heathered wool twist carpet with a natural, versatile look.', 'Cormar', 'Wool Twist', ARRAY[]::text[], ARRAY['Travertine']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/wool-twist/woodland-heather-twist/variants/travertine/', true),
  ('zenith', 'Zenith', 'Carpet', '100% Ultralux polypropylene', 25, 'Extra heavy domestic / medium contract', ARRAY['Living', 'Bedroom', 'Stairs', 'Hall']::text[], ARRAY[4, 5]::double precision[], 'twist', ARRAY['#C8BCA4', '#9C9380']::text[], '/ranges/cormar/zenith.jpg', 1, NULL, 'A hard-wearing easy-clean carpet with a soft finish for demanding household spaces.', 'Cormar', 'Easy Clean', ARRAY['Stain resistant', 'Bleach cleanable', '10 Year Stain & Wear Guarantee']::text[], ARRAY['Caribou', 'Yorkstone']::text[], 'https://www.cormarcarpets.co.uk/carpet-ranges/easy-clean/zenith/variants/caribou/', true)
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
UPDATE ranges SET active = false, showcase = NULL
 WHERE id IN ('hagley-twist','ridgacre-saxony','woodgate-loop','bartley-berber',
              'quinton-heather','nailers-felt-back','halesowen-stripe')
   AND EXISTS (SELECT 1 FROM added);

-- Placeholder fitting rates, pending the shop's real ones. These are
-- the same figures as PRICES in src/lib/pricing.ts, which the unit
-- tests use.
INSERT INTO rates
  (id, fit_carpet, fit_hard, fit_stair, uplift, gripper, doorbar, furniture,
   trim, wastage_hard, underlay_allowance, stair_area)
VALUES
  (1, 3.75, 9.5, 8.0, 2.2, 0.99, 7.0, 35.0, 0.1, 1.1, 1.05, 0.85)
ON CONFLICT (id) DO NOTHING;

UPDATE rates SET
  fit_carpet = 3.75,
  uplift = 2.2,
  gripper = 0.99,
  doorbar = 7.0,
  furniture = 35.0
WHERE id = 1;

-- The settings row, with every column at its default.
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
