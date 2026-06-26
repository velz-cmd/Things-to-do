/** Value Participants — every ecosystem role maps to one participant type. */
export type ParticipantRole =
  | "founder"
  | "maintainer"
  | "contributor"
  | "artist"
  | "composer"
  | "producer"
  | "designer"
  | "researcher"
  | "reviewer"
  | "moderator"
  | "translator"
  | "teacher"
  | "plugin_author"
  | "dataset_creator"
  | "package_author"
  | "documenter"
  | "dao_member";

export const PARTICIPANT_LABELS: Record<ParticipantRole, string> = {
  founder: "Founder",
  maintainer: "Maintainer",
  contributor: "Contributor",
  artist: "Artist",
  composer: "Composer",
  producer: "Producer",
  designer: "Designer",
  researcher: "Researcher",
  reviewer: "Reviewer",
  moderator: "Moderator",
  translator: "Translator",
  teacher: "Teacher",
  plugin_author: "Plugin author",
  dataset_creator: "Dataset creator",
  package_author: "Package author",
  documenter: "Documenter",
  dao_member: "DAO member",
};

/** Map payeeKeyType / connector context to participant role. */
export function roleForPayeeKeyType(payeeKeyType: string): ParticipantRole {
  switch (payeeKeyType) {
    case "github_login":
      return "contributor";
    case "listen_artist":
    case "music_artist":
      return "artist";
    case "composer":
      return "composer";
    case "producer":
      return "producer";
    case "writer":
      return "contributor";
    case "wallet":
      return "dao_member";
    default:
      return "contributor";
  }
}
