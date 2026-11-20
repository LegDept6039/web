import type { MunicipalContactSettings } from "./validation";

// Explicit mock-mode content only. Production reads the editable database row.
export const defaultMunicipalContact: MunicipalContactSettings = {
  id: "municipal",
  municipality_name: "Municipality of Pinamungajan",
  address: "Municipal Hall\nPinamungajan, Cebu\nPhilippines",
  telephone: null,
  email: null,
  office_hours: null,
  social_label: null,
  social_url: null,
  map_embed_url:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d635.3927542769925!2d123.58431921186467!3d10.270176820265034!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a96f90bd4bd703%3A0x7e7ba0656a6eb073!2sPinamungajan%20Municipal%20Hall!5e1!3m2!1sen!2sph!4v1795094335905!5m2!1sen!2sph",
  updated_at: "2026-11-19T00:00:00.000Z",
};
