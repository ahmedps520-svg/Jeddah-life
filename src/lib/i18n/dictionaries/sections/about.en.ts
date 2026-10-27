/** About & data sources page (English). */
const aboutEn = {
  title: "About JEDDAH LIFE",
  lede: "A city guide for answering one question: what should we do today? It's built on real places, honest estimates and clear labels about where every piece of information comes from.",
  sourcesTitle: "Where our information comes from",
  sources: [
    {
      title: "Landmarks researched by our team",
      body: "Museums, historic sites, malls, beaches and other key places were researched from OpenStreetMap, Wikidata and official websites. Each place page lists its sources and when it was checked. Places we couldn't confirm are shown as “Not yet verified”.",
    },
    {
      title: "Cafés, restaurants and other listings",
      body: "Imported from the Overture Maps Foundation places dataset (CDLA Permissive 2.0), which combines sources such as Meta and Microsoft. These listings are marked as not yet verified until someone on our team checks them.",
    },
    {
      title: "Maps and neighbourhood boundaries",
      body: "Map tiles by OpenFreeMap and OpenMapTiles with data © OpenStreetMap contributors (ODbL). Neighbourhood boundaries come from Overture Maps divisions, derived from OpenStreetMap.",
    },
    {
      title: "Photos",
      body: "Landmark and homepage photos are from Wikimedia Commons, each credited with its author and licence. Places without a free-to-use photo show an illustration instead of a borrowed image.",
    },
    {
      title: "Events",
      body: "Events are added by our team from organisers' official announcements. We don't list events we can't confirm, so the calendar is sometimes quiet.",
    },
    {
      title: "Reviews and ratings",
      body: "Ratings come only from reviews written on JEDDAH LIFE by signed-in members. We don't import or invent star ratings.",
    },
  ],
  readingTitle: "How to read what you see",
  reading: [
    { term: "Verified", body: "Details were checked by our team against official or well-documented sources on the date shown." },
    { term: "Not yet verified", body: "Imported or researched details we haven't confirmed. Check before you go." },
    { term: "Community", body: "Recommended by a member and approved by a moderator; details weren't independently verified." },
    { term: "Listed as open", body: "Based on the opening hours listed for the place, not live information. Hours can change, especially on holidays and during Ramadan." },
    { term: "Estimate", body: "When a place hasn't published prices, we show typical spend for that type of place. Verified prices are labelled separately; unknown prices are never counted as free." },
    { term: "Based on type of place", body: "Features like “family-friendly” or “indoor” are sometimes inferred from the kind of place and labelled that way." },
    { term: "Travel times", body: "Straight-line distance with an allowance for roads at typical city speeds — not live traffic." },
  ],
  searchTitle: "How search understands you",
  searchAi: "Search understands everyday requests in English and Arabic. On this server an AI model helps interpret requests, and results say when it was used. If it's unavailable, a rule-based interpreter takes over.",
  searchRules: "Search understands everyday requests in English and Arabic using a rule-based interpreter that recognises budgets, areas, times, group types and moods. No AI model is used on this server.",
  privacyTitle: "Privacy",
  privacy: [
    "You can browse, search and use the map without an account.",
    "Your location stays on your device. It's sent only with requests that sort by distance and isn't stored — unless you save an outing that starts from your location.",
    "Search queries are counted anonymously (without who searched) to show popular searches.",
    "If you're signed in and personalisation is on, we remember places you view to improve recommendations. You can turn this off in your profile.",
    "Uploaded photos are re-encoded and their metadata, including GPS location, is removed.",
    "We use cookies only to keep you signed in, remember your language, and remember you as a guest in shared plans. No advertising or third-party tracking.",
    "You can download your data or delete your account and everything linked to it from your profile at any time.",
  ],
  reportTitle: "Spotted something wrong?",
  reportBody: "Every place, event, review and recommendation has a “Report a problem” link. A moderator reviews each report.",
  checkedOn: "Landmark research last checked: {date}",
};

export default aboutEn;
