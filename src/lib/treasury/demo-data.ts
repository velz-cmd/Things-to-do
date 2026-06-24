/** Demo CSV for founder distribution batch — 50 events → 23 payees */
export const DEMO_DISTRIBUTION_CSV = `eventId,type,platformId,amountUsd,payload,demoVerified
evt-001,scrobble_verified,artist-mbid-001,0.0045,"{""durationSec"":45,""mediaFileId"":""track-1""}",true
evt-002,scrobble_verified,artist-mbid-001,0.0032,"{""durationSec"":32,""mediaFileId"":""track-2""}",true
evt-003,scrobble_verified,artist-mbid-002,0.0051,"{""durationSec"":51,""mediaFileId"":""track-3""}",true
evt-004,scrobble_verified,artist-mbid-002,0.0028,"{""durationSec"":28,""mediaFileId"":""track-4""}",false
evt-005,stream_presence_verified,stream-demo,0.0120,"{""durationSec"":120,""viewerId"":""u1""}",true
evt-006,stream_presence_verified,stream-demo,0.0085,"{""durationSec"":85,""viewerId"":""u2""}",true
evt-007,shared_link_verified,photo-jane,0.0500,"{""exifArtist"":""Jane Doe""}",true
evt-008,shared_link_verified,photo-marcus,0.0500,"{""exifArtist"":""Marcus Lee""}",true
evt-009,scrobble_verified,artist-mbid-001,0.0060,"{""durationSec"":60}",true
evt-010,scrobble_verified,artist-mbid-002,0.0040,"{""durationSec"":40}",true
evt-011,vod_session_verified,filmmaker-01,0.0150,"{""durationSec"":90}",true
evt-012,scrobble_verified,artist-mbid-001,0.0035,"{""durationSec"":35}",true
evt-013,stream_presence_verified,stream-demo,0.0200,"{""durationSec"":200}",true
evt-014,shared_link_verified,photo-jane,0.0300,"{""exifArtist"":""Jane Doe""}",true
evt-015,citation_verified,writer@fosstodon.org,0.0010,"{""link"":""https://blog.example/post-1""}",true
evt-016,scrobble_verified,artist-mbid-002,0.0075,"{""durationSec"":75}",true
evt-017,scrobble_verified,artist-mbid-001,0.0025,"{""durationSec"":25}",false
evt-018,stream_presence_verified,stream-demo,0.0090,"{""durationSec"":90}",true
evt-019,shared_link_verified,photo-marcus,0.0400,"{""exifArtist"":""Marcus Lee""}",true
evt-020,scrobble_verified,artist-mbid-002,0.0055,"{""durationSec"":55}",true`;

export const PAYMENT_MISSION_EXAMPLES = [
  {
    label: "Pay designer on approval",
    templateId: "bounty-designer-200",
    text: "Pay designer $200 when logo approved",
  },
  {
    label: "Release PR bounty",
    templateId: "bounty-pr-merge",
    text: "Release bounty when GitHub PR merged",
  },
  {
    label: "Pay researcher",
    templateId: "bounty-researcher-500",
    text: "Pay researcher when report delivered",
  },
  {
    label: "Distribute to creators",
    templateId: "distribute-creators",
    text: "Distribute to open-source creators",
  },
];
