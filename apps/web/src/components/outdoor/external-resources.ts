export interface ExternalResource {
  id: string;
  url: string;
  category: string;
}

export const EXTERNAL_RESOURCES: ExternalResource[] = [
  { id: "go4life_walking", url: "https://go4life.nia.nih.gov", category: "general" },
  { id: "nhs_walking",     url: "https://www.nhs.uk/live-well/exercise/walking-for-health", category: "walking" },
  { id: "traillink",       url: "https://www.traillink.com", category: "hiking" },
  { id: "silversneakers",  url: "https://www.silversneakers.com", category: "general" },
  { id: "cycling_uk",      url: "https://www.cyclinguk.org", category: "cycling" },
];
