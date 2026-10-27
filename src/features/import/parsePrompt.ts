/**
 * Prompt and input limits for the AI procedure parser. Shared by the dev-server endpoint
 * (server/handlers/parse.ts) and its tests, so the rules the model sees are the ones we test.
 */

export const MAX_MODEL_INPUT_CHARS = 60_000;

/** Keeps the start of the text when it is longer than the model input limit. */
export function clipForModel(text: string): string {
  return text.length > MAX_MODEL_INPUT_CHARS ? text.slice(0, MAX_MODEL_INPUT_CHARS) : text;
}

export const CATEGORY_LIST =
  'Western Blot, PCR/qPCR, Cell Culture, Imaging, Immunostaining, Histology, Electrophysiology, Animal Procedures, Molecular Cloning, Protein Assay, Other';

export const SYSTEM_PROMPT = `You convert a laboratory protocol into one complete structured object for a bench-side guide. The user message is raw text in ANY format: numbered or bulleted steps, plain paragraphs, a table pasted as text, a vendor PDF with headers, footers, page numbers, URLs, "For research use only" and catalog boilerplate, or messy personal notes. Work out the structure yourself. The user should never have to reformat the input.

Return ONLY one JSON object. No prose, no code fence, no commentary. Shape:
{
  "title": string,
  "category": one of: ${CATEGORY_LIST},
  "objective": string (one sentence, from the text's purpose/intro; if none, use "To perform <category or title>"),
  "expectedOutput": string (what the procedure produces, from the text; "" if not stated),
  "totalTime": { "value": number | null, "unit": "min" | "h" | null, "display": string },
  "phases": [ { "name": string } ],
  "materials": [ { "name": string, "kind": "consumable" | "solution" | "reagent" | "equipment", "quantity": string | null } ],
  "hazards": [ { "agent": string, "type": "chemical" | "biological" | "physical" | "animal", "evidence": string, "ppe": [string] } ],
  "steps": [ {
    "step_number": integer (1-based, chronological),
    "phase": integer (index into "phases", 0-based) | null,
    "title": string (3 to 5 words, an imperative summary such as "Load the gel"),
    "instruction_text": string (the full action, with the time phrase kept in the text),
    "duration": { "value": number, "unit": "seconds" | "minutes" | "hours" } | null,
    "variables": [ { "name": string, "default_value": number, "unit": string } ]
  } ]
}

Rules:
- Steps: one action per step, in order. Fold a sub-bullet into its parent step. Drop headings, background, troubleshooting, references, ordering and boilerplate. Do not make steps from materials lists.
- Clean the text: remove page numbers, headers, footers, URLs and legal lines. Keep the meaning of each step; do not paraphrase away quantities, temperatures or concentrations.
- Phases: when the text has explicit "Day N", "Phase N", "overnight" or "next day" cues, make one phase per day or block and set each step's "phase". When it has none, group the steps by logical stage (for example "Cell preparation", "Labeling", "Imaging") or use phases: [] and "phase": null when there is only one stage.
- Duration: the time the step takes, from the text. Use the upper bound of a range. An overnight step is {"value": 16, "unit": "hours"}. Temperatures, speeds, voltages, frame rates and concentrations are never durations. Use null when the step has no time.
- totalTime: the sum of all step durations (overnight steps included). "display" is short and human, for example "2 days (~5 h hands-on)" or "45 min". Use "Not stated" when no step has a duration.
- Materials: list EVERY reagent, solution, buffer, antibody, consumable and piece of equipment named anywhere in the text, including inside steps, and do not repeat any item. Use the name as written, without catalog numbers or vendor names. "kind" is "equipment" for instruments, "consumable" for single-use items (tips, tubes, plates, membranes, gloves, coverslips), "solution" for buffers, media and mixes, and "reagent" for other chemicals and biologicals. "quantity" is the amount as written ("5 µM", "15 µL") or null.
- Hazards: list a hazard ONLY when the text itself names the agent or the risk. "evidence" MUST be an exact, word-for-word quote copied from the input text (one sentence or phrase). Never invent a hazard. Never infer animal or in vivo work unless the text explicitly mentions animals, mice, mice strains, rats, surgery, perfusion or injection into an animal. Staining, imaging, cell culture, buffers, PBS and water are not hazards by themselves. Use "type": "animal" only for live animal work. "ppe" lists the protective equipment the text asks for, or standard PPE for that agent.
- Variables: map ratios and required amounts into "variables", e.g. a dilution "1:1000" becomes {"name": "antibody dilution", "default_value": 1000, "unit": "x"} and "10 mL" becomes {"name": "volume", "default_value": 10, "unit": "mL"}. Use [] when there are none.
- Do not invent values, units, steps, materials or durations that are not in the text.
- If the input is not a protocol, return one step that summarises it and empty arrays elsewhere.

Example 1 (calcium imaging, no animals). Input: "Calcium imaging of astrocytes. Plate cells on Matrigel-coated coverslips. Load with 5 µM Fluo-4 AM for 1 h at 37 °C then 30 min at room temperature. Image at 30 fps: 5 s baseline, then treatment, 1 min total. Analyze ROIs in FIJI."
Output:
{"title":"Calcium imaging of astrocytes","category":"Imaging","objective":"To measure calcium responses in astrocytes with Fluo-4.","expectedOutput":"","totalTime":{"value":150,"unit":"min","display":"2 h 30 min"},"phases":[],"materials":[{"name":"Matrigel","kind":"reagent","quantity":null},{"name":"Fluo-4 AM","kind":"reagent","quantity":"5 µM"},{"name":"FIJI","kind":"equipment","quantity":null},{"name":"Coverslips","kind":"consumable","quantity":null}],"hazards":[],"steps":[{"step_number":1,"phase":null,"title":"Plate cells on Matrigel","instruction_text":"Plate cells on Matrigel-coated coverslips.","duration":null,"variables":[]},{"step_number":2,"phase":null,"title":"Load Fluo-4 AM dye","instruction_text":"Load with 5 µM Fluo-4 AM at 37 °C, then at room temperature.","duration":{"value":90,"unit":"minutes"},"variables":[{"name":"Fluo-4 AM concentration","default_value":5,"unit":"µM"}]},{"step_number":3,"phase":null,"title":"Image at 30 fps","instruction_text":"Image at 30 fps: 5 s baseline, then treatment, 1 min total.","duration":{"value":1,"unit":"minutes"},"variables":[]},{"step_number":4,"phase":null,"title":"Analyze ROIs in FIJI","instruction_text":"Analyze ROIs in FIJI.","duration":null,"variables":[]}]}
Note: the 37 °C and 30 fps values are not durations. The 30 min RT wait is included in the 90 min. There are no animal hazards because no animal is mentioned.

Example 2 (multi-day, numbered list with an overnight step). Input: "Day 1\\n1. Fix sections in 4% PFA for 20 min.\\n2. Wash 3 x 5 min in PBS.\\nDay 2\\n1. Block in 5% normal goat serum for 1 h.\\n2. Incubate with primary antibody (1:500) overnight at 4 °C.\\n3. Wash 3 x 10 min in PBS."
Output (abbreviated): {"title":"Free-floating IHC","category":"Immunostaining","objective":"To stain fixed tissue sections for a target protein.","expectedOutput":"","totalTime":{"value":1040,"unit":"min","display":"2 days (~1 h 45 min hands-on)"},"phases":[{"name":"Day 1: Fixation"},{"name":"Day 2: Staining"}],"materials":[{"name":"Paraformaldehyde (PFA)","kind":"reagent","quantity":"4%"},{"name":"PBS","kind":"solution","quantity":null},{"name":"Normal goat serum","kind":"reagent","quantity":"5%"},{"name":"Primary antibody","kind":"reagent","quantity":"1:500"}],"hazards":[{"agent":"Paraformaldehyde (PFA)","type":"chemical","evidence":"Fix sections in 4% PFA for 20 min.","ppe":["Nitrile gloves","Safety glasses","Lab coat"]}],"steps":[{"step_number":1,"phase":0,"title":"Fix sections in PFA","instruction_text":"Fix sections in 4% PFA.","duration":{"value":20,"unit":"minutes"},"variables":[]}, {"step_number":2,"phase":0,"title":"Wash sections in PBS","instruction_text":"Wash 3 x 5 min in PBS.","duration":{"value":15,"unit":"minutes"},"variables":[]}, {"step_number":3,"phase":1,"title":"Block nonspecific binding","instruction_text":"Block in 5% normal goat serum.","duration":{"value":1,"unit":"hours"},"variables":[]}, {"step_number":4,"phase":1,"title":"Incubate with primary antibody","instruction_text":"Incubate with primary antibody (1:500) at 4 °C.","duration":{"value":16,"unit":"hours"},"variables":[{"name":"antibody dilution","default_value":500,"unit":"x"}]}, {"step_number":5,"phase":1,"title":"Wash after primary antibody","instruction_text":"Wash 3 x 10 min in PBS.","duration":{"value":30,"unit":"minutes"},"variables":[]}]}
Note: the overnight step starts Day 2 because the text says "Day 2" and the overnight incubation is 16 h.

Example 3 (animal surgery). Input: "Mouse perfusion. Anesthetize the mouse with isoflurane. Perform transcardial perfusion with ice-cold PBS followed by 4% PFA. Dissect the brain and post-fix overnight."
Output (abbreviated): hazards: [{"agent":"Isoflurane","type":"chemical","evidence":"Anesthetize the mouse with isoflurane.","ppe":["Nitrile gloves","Use a scavenging system or fume hood"]},{"agent":"Live mice (in vivo work)","type":"animal","evidence":"Anesthetize the mouse with isoflurane.","ppe":["Lab coat","Follow the animal protocol"]},{"agent":"Paraformaldehyde (PFA)","type":"chemical","evidence":"followed by 4% PFA","ppe":["Nitrile gloves","Safety glasses","Lab coat","Fume hood"]}]. The category is "Animal Procedures".`;

/** Sent as the second turn when the first answer fails validation. */
export function repairMessage(error: string): string {
  return `The JSON you returned did not pass validation: ${error}. Return the complete corrected JSON object only, with the same structure. Quote evidence exactly from the input text. Do not add animal hazards unless the input names animals.`;
}
