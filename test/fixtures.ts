/** Shared test fixtures: WPForms "Spiral OS entry" notifications as they arrive in Gmail. */

/** The notification as WPForms would render it in an HTML email (template + smart tags filled in). */
export const ABANDONED_HTML = `<html><head><style>p{margin:0}</style></head><body><table><tr><td>
<p>Spiral OS entry<br />Type: abandoned<br />Form ID: 25662<br />Form: Park Your License<br />Entry ID: 812<br />
Page: <a href="https://spiralny.com/park-your-license/">https://spiralny.com/park-your-license/</a><br />
Name: Bob Smith<br />Email: <a href="mailto:bob@example.com">Bob@Example.com</a><br />Phone: (917) 555-0134<br />
License: <br />Plan: <br />Amount: <br />---<br /></p>
<table><tr><td><strong>Name</strong></td></tr><tr><td>Bob Smith</td></tr></table>
</td></tr></table></body></html>`;

export const COMPLETE_TEXT = `Spiral OS entry
Type: complete
Form ID: 23785
Form: 100% Commission Sign Up
Entry ID: 1450
Page: https://spiralny.com/brooklyn-100-commission-brokerage/?utm_source=google
Name: Jane Doe
Email: jane@example.com
Phone: +1 646 555 0199
License: 10401234567
Plan: 100% Plan
Amount: $498.16
---
Name
Jane Doe`;

/**
 * The lead sheet's tabs as the Sheets API returns them (unformatted values),
 * laid out like Spiral NY's real sheet on 2026-11-23. People are made up.
 */
export const LEAD_SHEET_TABS_FIXTURE: Record<string, unknown[][]> = {
  "SIGNED!": [
    ["Date Joined", "First Name", "Last Name", "Phone number", "Email", "Status", "License Number", "Check if Associated", "Added to WhatsApp Group", "Notes / How did you find us?"],
    ["November 11, 2026", "Jane", "Doe", 16465550199, "jane@example.com", "Platinum 100%", 10401234567, true, true, "Referral to 90%"],
    [46340, "Sam ", "Lee", "(917) 555-0101", "sam@example.com", "Park Your License", "40DE0000001", true, false, ""],
  ],
  "FWD/FRESH": [
    ["Date", "First Name", "Last Name", "Phone number", "Email", "Status", "Inquiring about?", "Notes", "How did you find us?", "License Number", "Text", "Email", "Cold-Call"],
    ["11/13/2026", "Pat", "Kim", "‪(631) 555-0102‬", "Pat@Example.com", "Interested", "90%", "VM", "Google search", "", true, true, true],
    ["", "", "", "", "", "", "", "", "", "", false, false, false],
    ["-", "Undated", "Person", "", "undated@example.com", "Interested", "Unknown", "", "", "", true, true, true],
  ],
  Instantly: [
    ["Date of Inquiry", "First Name", "Last Name", "Phone number", "Email", "Status", "Inquiring about?", "Inquiry/Last message", "License Number", "Notes", "Text", "Email", "Cold-Call"],
    ["November 5, 2026", "Lee", "Park", "718-555-0103", "lee@example.com other@example.com", "Interested", "Park Your License", "How does this work?", "", "VM", true, false, true],
  ],
};
