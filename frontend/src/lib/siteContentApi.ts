import { apiRequest } from "./apiClient";

export type AlbumItem = {
  image: string;
  title: string;
};

export type TestimonialItem = {
  quote: string;
  name: string;
  role: string;
  detail: string;
  image: string;
};

export type BadgeLevelItem = {
  name: string;
  image: string;
  className: string;
};

export type TrainerProfile = {
  name: string;
  image: string;
  role: string;
  label: string;
};

export type SiteContent = {
  album_items: AlbumItem[];
  videos: string[];
  testimonials: TestimonialItem[];
  badge_levels: BadgeLevelItem[];
  trainers: TrainerProfile[];
};

export const EMPTY_SITE_CONTENT: SiteContent = {
  album_items: [],
  videos: [],
  testimonials: [],
  badge_levels: [],
  trainers: [],
};

export async function fetchPublicSiteContent(): Promise<SiteContent> {
  return apiRequest<SiteContent>("/site-content");
}
