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
