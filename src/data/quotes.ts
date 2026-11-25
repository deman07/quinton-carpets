/**
 * Real reviews, copied verbatim from Google, Yell, Facebook and Yelp
 * with the name and the source. The home page shows the Google ones
 * posted with photos (those with `photos`), added at the shop's request.
 *
 * DO NOT invent, edit, shorten, reorder for effect or add to this
 * list. Phase two replaces it with the live Google Business Profile
 * feed; until then there is no AggregateRating in the structured
 * data, because these are not yet machine-verifiable.
 */

import { BUSINESS } from "./business.ts";

export type Quote = {
  t: string;
  n: string;
  s: string;
  /**
   * For a Google review the customer posted photos with: the review's
   * own share link (Google Maps → the review → Share → Copy link) and
   * how many photos it has. The home page shows only these once there
   * are any.
   */
  photos?: { url: string; count: number };
};

export const QUOTES: Quote[] = [
  { t: "Best carpet shop I've ever been to. Amazing staff very polite, well mannered and helpful.", n: "Millsy 1976", s: "Google" },
  { t: "Very pleased with the professional service we received from Aman and staff - Quinton Carpets.", n: "Deborah Checkley", s: "Google" },
  { t: "Great place best service we have had carpet fitted looks amazing. Brilliant work.", n: "Tracey Brookes", s: "Google" },
  { t: "I received a first class service and a quality product at an excellent price from Quinton Carpets.", n: "MartinW-577", s: "Yell" },
  { t: "Another good job done by Aman & his team nothing too much trouble for them very reliable", n: "Tracy Joyner", s: "Google" },
  { t: "Excellent customer service again. Reasonable price. Convenient appointment made for fitting.", n: "Pat Seddon", s: "Google" },
  { t: "Really friendly service, good prices and fitting service. Good to see a great local business", n: "ElaineQuinton", s: "Yell" },
  { t: "Thanks lads Great job!! supplied and fitted our stair and hallway carpet", n: "Steve Castle", s: "Google" },
  { t: "Good quality carpet at a very reasonable price. Fantastic service, very helpful", n: "Ann Marie Woodall", s: "Facebook" },
  { t: "Great customer service Great advise and don't charge an arm and leg", n: "Leanne O'Condell", s: "Google" },
  { t: "You was very efficient in your work and didn't leave till it was 100%", n: "Victoria Stokes", s: "Facebook" },
  { t: "Excellent service very quick and expertly fitted bedroom carpet", n: "Karen Griffiths", s: "Google" },

  // Google reviews posted with photos of the job, copied as Google shows
  // them. Where Google cuts a long review off behind "More", the quote
  // ends where Google's does, with "…", and the link leads to the rest.
  // The link is the shop's Google listing until each review's own share
  // link (the review → Share → Copy link) is put in its place.
  { t: "Had stairs, landing and bedroom carpet fiited The fitters arrived on time and were very friendly and polite. They were very tidy and cleaned up all mess. …", n: "Lee Shaw", s: "Google", photos: { url: BUSINESS.mapsUrl, count: 3 } },
  { t: "I popped into Quinton Carpets looking for a feature stair carpet, without anything specific in mind. …", n: "P L", s: "Google", photos: { url: BUSINESS.mapsUrl, count: 4 } },
  { t: "Used Quinton Carpets for the first time and had my carpet and Lino fitted in. Workers were friendly, polite and quick! . The booking process at the shop was great too as Michelle was so pleasant to work with and she gave me all the help I …", n: "Nalisha Khaan", s: "Google", photos: { url: BUSINESS.mapsUrl, count: 4 } },
  { t: "Absolutely outstanding!!! It's always a minefield finding a quality tradesman as I know being a painter and decorator for 30 years but I can't stress enough how good this company is ! The boss Aman fitted our stairs and landing striped …", n: "Wayne Murray", s: "Google", photos: { url: BUSINESS.mapsUrl, count: 5 } },
  { t: "They turned up when they said they would. Good advice and reasonable price. Well fitted, very pleased.", n: "Scott Andrews", s: "Google", photos: { url: BUSINESS.mapsUrl, count: 5 } },
  { t: "Third time Quinton Carpets have come to fit me carpet. They've done 2 bedrooms, lounge/dining and stairway/landing. I would highly recommend them. Carpets and underlay are high quality, prices are very reasonable and the team work really …", n: "Katie Walker", s: "Google", photos: { url: BUSINESS.mapsUrl, count: 4 } },
  { t: "I was recommended Quinton Carpets by a friend, very reasonable prices for quality carpets & wood flooring. I chose wood flooring for the living room and hallway, and carpet for the stairs, landing and bedrooms. Extremely pleased with how it …", n: "Ella Alexandra", s: "Google", photos: { url: BUSINESS.mapsUrl, count: 3 } },
  { t: "Aman did a fantastic job. Today he fitted the stairs and I should say that I am absolutely 👍 happy with the quality of the carpets and fitting, highly recommend his professional advice and service.", n: "Nazy Solt", s: "Google", photos: { url: BUSINESS.mapsUrl, count: 4 } },
  { t: "I rated this excellent carpet shop five stars for their exceptional service in fitting the carpet in my new home. I obtained quotes from four different carpet shops in Smethwick and Halesowen as I always look for the best, yet cheapest …", n: "Tofy A.A", s: "Google", photos: { url: BUSINESS.mapsUrl, count: 5 } },
  { t: "I rang Quinton Carpets after being told they were god; Michelle answered the phone and was friendly and helpful and said she would get Aman to come round to quote; 15 minutes late Aman arrived and was great to deal with, quoted on the spot …", n: "Louis Kimberley", s: "Google", photos: { url: BUSINESS.mapsUrl, count: 2 } },
  { t: "Brilliant service ten out of ten superb fitting could not fault lm delighted it has transformed my house my friends are so impressed lve sent photos to them all l won’t use any other company in future the owner is such an expert at fitting and so knowledgable would highly recommend", n: "Anne Webb", s: "Google", photos: { url: BUSINESS.mapsUrl, count: 4 } },
];
