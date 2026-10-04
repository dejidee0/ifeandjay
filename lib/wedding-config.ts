export const weddingConfig = {
  couple: {
    groom: "Adedeji Ifedayo Micheal",
    bride: "Joyce Passion Akora",
    displayGroom: "Ifedayo",
    displayBride: "Joyce",
  },
  event: {
    title: "Traditional Wedding",
    month: "November 2026",
    exactDate: null as string | null,
    time: "To be announced",
    venue: "Venue to be announced",
    mapUrl: null as string | null,
  },
  families: {
    groom: "The Adedeji Family",
    bride: "The Akora Family",
  },
  story: [
    {
      hash: "first-hello",
      date: "Chapter 01",
      title: "Two paths, one beginning",
      body: "A simple hello became the first line in a story neither of us wanted to stop writing.",
    },
    {
      hash: "choose-us",
      date: "Chapter 02",
      title: "Building with intention",
      body: "Through ordinary days and big dreams, we kept choosing patience, laughter and each other.",
    },
    {
      hash: "forever",
      date: "Chapter 03",
      title: "The forever commit",
      body: "Now our families come together as we begin a new branch—rooted in love and made for a lifetime.",
    },
  ],
  programme: [
    "Guest arrival & welcome",
    "Opening prayers",
    "Family introductions",
    "Traditional rites",
    "Celebration & portraits",
  ],
  dressCode: {
    guests: "Deep wine, burgundy & warm ivory",
    bride: "Jewel teal with luminous beadwork",
    groom: "Deep teal agbada with black bead accents",
    asoebi: "Asoebi fabric and collection details will be shared by the family representatives.",
  },
  rsvpDeadline: "RSVP deadline will be announced with the exact date.",
} as const;

export type WeddingConfig = typeof weddingConfig;
