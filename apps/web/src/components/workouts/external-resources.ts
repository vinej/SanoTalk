export interface ExternalResource {
  id: string;
  url: string;
  category: string;
}

export const EXTERNAL_RESOURCES: ExternalResource[] = [
  { id: "go4life",     url: "https://go4life.nia.nih.gov",             category: "general" },
  { id: "nhs_seniors", url: "https://www.nhs.uk/live-well/exercise/exercise-guidelines/physical-activity-guidelines-older-adults/", category: "general" },
  { id: "tai_chi_health", url: "https://taichiforhealthinstitute.org", category: "tai_chi" },
  { id: "silversneakers", url: "https://www.silversneakers.com",       category: "general" },
  { id: "eldergym",    url: "https://eldergym.com",                    category: "strength" },
];
