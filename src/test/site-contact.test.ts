import { describe, expect, it } from "vitest";

import { SITE_CONTACT } from "@/lib/site-contact";

describe("Site contact details", () => {
  it("shows the email the owner asked for", () => {
    expect(SITE_CONTACT.email).toBe("mucunguziadolph6@gmail.com");
  });

  it("shows both phone numbers the owner gave, each dialable", () => {
    expect(SITE_CONTACT.phones.map((p) => p.display)).toEqual(["+250 795176388", "+250 791576482"]);
    expect(SITE_CONTACT.phones.map((p) => p.tel)).toEqual(["tel:+250795176388", "tel:+250791576482"]);
  });
});
