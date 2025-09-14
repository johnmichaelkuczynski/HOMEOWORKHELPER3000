import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';

/*
<important_code_snippet_instructions>
The newest OpenAI model is "gpt-4o" which was released May 13, 2024. Do not change this unless explicitly requested by the user.
The newest Anthropic model is "claude-sonnet-4-20250514", not "claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022" nor "claude-3-sonnet-20240229". 
</important_code_snippet_instructions>
*/

// <important_do_not_delete>
const DEFAULT_OPENAI_MODEL = "gpt-4o";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
// </important_do_not_delete>

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key",
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_ENV_VAR || "default_key",
});

const PRESET_TEXT: Record<string,string> = {
  // Advanced Techniques
  "Mixed cadence + clause sprawl": "Alternate short and long sentences; allow some long sentences to wander with extra clauses.",
  "Asymmetric emphasis": "Over-elaborate one point; compress or skate past another.",
  "One aside": "Add a quick parenthetical or em-dash remark — factual, not jokey.",
  "Hedge twice": "Use two mild uncertainty markers (\"probably,\" \"seems,\" \"roughly,\" \"I think\").",
  "Local disfluency": "Keep one redundant or slightly awkward phrase that still makes sense.",
  "Analogy injection": "Insert a short, concrete comparison to something unrelated but illustrative.",
  "Topic snap": "Abruptly shift focus once, then return.",
  "Friction detail": "Drop in a small, seemingly unnecessary but real-world-plausible detail.",
  
  "Compression — light (−15%)": "Cut filler; merge short clauses; keep meaning. Target ≈15% shorter.",
  "Compression — medium (−30%)": "Trim hard; delete throat-clearing; tighten syntax. Target ≈30% shorter.",
  "Compression — heavy (−45%)": "Sever redundancies; collapse repeats; keep core claims. Target ≈45% shorter.",
  "Mixed cadence": "Alternate short (5–12 words) and long (20–35 words) sentences; avoid uniform rhythm.",
  "Clause surgery": "Reorder main/subordinate clauses in ~30% of sentences without changing meaning.",
  "Front-load claim": "Put the main conclusion in sentence 1; evidence follows.",
  "Back-load claim": "Delay the main conclusion to the final 2–3 sentences.",
  "Seam/pivot": "Drop smooth connectors once; allow one abrupt thematic pivot.",
  "Imply one step": "Omit one obvious inferential step; keep it implicit (context makes it recoverable).",
  "Conditional framing": "Recast one key sentence as: If/Unless …, then …. Keep content identical.",
  "Local contrast": "Use exactly one contrast marker (but/except/aside) to mark a boundary; add no new facts.",
  "Scope check": "Replace one absolute with a bounded form (e.g., 'in cases like these').",
  "Deflate jargon": "Swap nominalizations for plain verbs where safe (e.g., utilization→use).",
  "Kill stock transitions": "Delete 'Moreover/Furthermore/In conclusion' everywhere.",
  "Hedge once": "Use exactly one hedge: probably/roughly/more or less.",
  "Drop intensifiers": "Remove 'very/clearly/obviously/significantly'.",
  "Low-heat voice": "Prefer plain verbs; avoid showy synonyms.",
  "One aside": "Allow one short parenthetical or em-dash aside; strictly factual.",
  "Concrete benchmark": "Replace one vague scale with a testable one (e.g., 'enough to X').",
  "Swap generic example": "If the source has an example, make it slightly more specific; else skip.",
  "Metric nudge": "Replace 'more/better' with a minimal, source-safe comparator (e.g., 'more than last case').",
  "Asymmetric emphasis": "Linger on the main claim; compress secondary points sharply.",
  "Cull repeats": "Delete duplicated sentences/ideas; keep the strongest instance.",
  "Topic snap": "Allow one abrupt focus change; no recap.",
  "No lists": "Output as continuous prose; remove bullets/numbering.",
  "No meta": "No prefaces/apologies/phrases like 'as requested'.",
  "Exact nouns": "Replace ambiguous pronouns with exact nouns.",
  "Quote once": "If the source has a strong phrase, quote it once; otherwise skip.",
  "Claim lock": "Do not add examples, scenarios, or data not present in the source.",
  "Entity lock": "Keep names, counts, and attributions exactly as given.",
  // Combo presets expand to atomic ones:
  "Lean & Sharp": "Compression — medium (−30%); Mixed cadence; Imply one step; Kill stock transitions",
  "Analytic": "Clause surgery; Front-load claim; Scope check; Exact nouns; No lists",
};

function expandPresets(selected: string[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const txt = PRESET_TEXT[name];
    if (!txt) return;
    if (txt.includes(";") && !txt.includes("…")) {
      // combo: split by ';' and add atomic names
      txt.split(";").map(s => s.trim()).forEach(alias => { if (PRESET_TEXT[alias] && !seen.has(alias)) { seen.add(alias); out.push(alias); }});
    } else {
      if (!seen.has(name)) { seen.add(name); out.push(name); }
    }
  };
  selected.forEach(add);
  return out;
}

function buildPresetBlock(selectedPresets?: string[], customInstructions?: string): string {
  const expanded = expandPresets(selectedPresets || []);
  const lines: string[] = [];
  expanded.forEach(name => { lines.push(`- ${PRESET_TEXT[name]}`); });
  const custom = (customInstructions || "").trim();
  if (custom) lines.push(`- ${custom}`);
  if (lines.length === 0) return "";
  return `Apply ONLY these additional rewrite instructions (no other goals):\n${lines.join("\n")}\n\n`;
}

// Style samples collection - new samples added at top
const STYLE_SAMPLES = {
  // NEW SAMPLES WILL BE ADDED HERE

  // Inferential knowledge and logical dependence style
  "inferential_knowledge": `Inferential knowledge and logical dependence Two kinds of knowledge: direct and indirect
Some knowledge is direct; some is indirect.
Indirect knowledge is knowledge that is acquired through inference.
To make an inference is to form a new belief on the basis of an old one.
Inferences, when legitimate, are made in accordance with legitimate rules of inference. Rules of inference, when legitimate, correspond to dependence-relations.

Two kinds of dependence-relations: causal and logical

There are two kinds of dependence-relations: logical and causal.
  Logical dependence-relations hold among propositions. A proposition is a truth or a falsehood.
  Example of a logical dependence-relation: The proposition that x is a triangle cannot be true unless the proposition that x has three sides is true. Therefore, x s being a triangle depends on x s having three sides.
  Causal relations hold among states of affairs, not truths and falsehoods. (A state of affairs is anything that is in space-time.)
Example of a causal dependence-relation: Smith cannot pass the class unless Smith studies.
Therefore, Smith s passing depends on his studying.
The first-dependence relation is interpropositional, i.e. it holds between propositions.
  The second is objectual, i.e. it holds between occupants of the space-time manifold and therefore between  objects,  relative to some delineation of that term.

Propositions the objects of belief
   The objects of knowledge are propositions. It isn't known unless it's believed and it isn't believed unless it's a proposition.
   One can be aware of non-propositions, e.g. rocks, trees, people, but one does not in the relevant sense know them. Rather, one knows truths about them.

Relations of logical dependence not known through observation
   Some dependence-relations are known, not through sensory observation, but through conceptual analysis. Such truths are analytic, as opposed to empirical. Examples of analytic truths are:

1. If P, then either P or Q.

2. There are infinitely many primes.

3. Nothing can be numerate or literate without being sentient.

4. There are no laws where there is no government.

5. There is no recursive definition of the class of Dedekind-cuts.

6. 1+1=2.

7. 1+1?3.


  1 obviously expresses a dependence-relation, and 2-7 non-obviously do so, as their meanings are:


  2*. A set s having finitely many members depends on its not having the set of prime numbers as a subset.

3*. An entity s being literate or numerate depends on its being sentient. 4*. The presence of law depends on the presence of government.
  5*. A set s having either finitely many or denumerably many members depends on its not having a cardinality equal to or greater than the cardinality of the class of Dedekind cuts.

6*. A set s being a couple depends on its being the union of two non-overlapping unit sets. 7*. A set s being a triple depends on its not being the union of two non-overlapping unit sets.

Analytic truth and analytic knowledge

Analytic knowledge is always knowledge of dependence-relations.
Empirical knowledge can be either direct or indirect; the same is true of analytic knowledge.

Knowledge vs. awareness
   Knowledge is conceptually articulated awareness. In order for me to know that my shoes are uncomfortably tight, I need to have the concepts shoe, tight, discomfort, etc. I do not need to have these concepts---or, arguably, any concepts---to be aware of the uncomfortable tightness in my shoes. My knowledge of that truth is a conceptualization of my awareness of that state of affairs.
  Equivalently, there are two kinds of awareness: propositional and objectual. My visual perception of the dog in front of me is a case of objectual awareness, as is my awareness of the tightness of my shoes. My knowledge that there is a dog in front of me is a case of proposition- awareness, as is my knowledge that my shoes are uncomfortably tight.`,

  // Default formal academic sample
  "formal_academic": `DEFAULT STYLE SAMPLE (The Raven Paradox):

Presumably, logically equivalent statements are confirmationally equivalent. In other words, if two statements entail each other, then anything that one confirms the one statement to a given degree also confirms the other statement to that degree. But this actually seems false when consider statement-pairs such as: 

(i) All ravens are black, 
and 
(ii) All non-black things are non-ravens, 

which, though logically equivalent, seem to confirmationally equivalent, in that a non-black non-raven confirms (ii) to a high degree but confirms (i) to no degree or at most to a low degree. 
A number of very contrived solutions to this paradox have been proposed, all of which either deny that there is a paradox or invent ad hoc systems of logic to validate the 'solution' in question. 
But the real solution is clear. First of all, it is only principled generalizations that can be confirmed. Supposing that you assert (i) with the intention of affirming a principled as opposed to an accidental generalization, you are saying that instances of the property of being a raven grounds or causes instances of blackness. Read thus, (i) is most certainly not equivalent with (ii) or with any variation thereof. Be it noted that while there is a natural nomic or causal reading of (i), there is no such reading of (ii). Finally, the reason that we are not inclined to regard a non-black non-raven — say, a white shoe — as confirming "All ravens are black" is that we would never have adduced "All ravens are black" in the first place were we interested in making a point about white shoes, and so such white shoes are not, from the relevant point of view, supportive instances. A helpful analogy: "All books by Tom Clancy are popular" is confirmed by examples of popular Tom Clancy novels, but not by popular Stephen King novels, although "All books by Tom Clancy are popular" and "All books by people other than Tom Clancy that are not popular are books by people other than Tom Clancy" are logically equivalent.`
};

function buildRewritePrompt(params: {
  inputText: string;
  styleText?: string;
  contentMixText?: string;
  selectedPresets?: string[];
  customInstructions?: string;
}): string {
  const hasStyle = !!(params.styleText && params.styleText.trim() !== "");
  const hasContent = !!(params.contentMixText && params.contentMixText.trim() !== "");
  
  // Use provided styleText, or fall back to first available style sample
  const styleSample = hasStyle ? params.styleText! : Object.values(STYLE_SAMPLES)[0];

  let prompt = `Your task is to rewrite the input text using the exact writing style demonstrated in the style sample below.

CRITICAL: You must deeply analyze and adopt ALL stylistic elements from this sample:

STYLE SAMPLE TO EMULATE:
"${styleSample}"

STYLE ANALYSIS REQUIREMENTS:
1. SENTENCE STRUCTURE: Observe the sample's sentence length patterns, complexity, and rhythm. Notice how it uses simple vs complex sentences, coordination vs subordination, and sentence variety.

2. VOCABULARY & WORD CHOICE: Pay attention to the formality level, technical terms, common vs sophisticated vocabulary, and any distinctive word preferences or patterns.

3. TONE & VOICE: Identify the sample's attitude (formal/informal, confident/tentative, academic/conversational), perspective (first/third person), and emotional register.

4. TRANSITIONS & FLOW: Notice how ideas connect - does it use explicit transitions, implicit connections, or specific linking strategies?

5. ARGUMENTATIVE PATTERNS: Observe how the sample presents ideas, structures arguments, uses examples, and develops reasoning.

6. PUNCTUATION & MECHANICS: Notice distinctive punctuation choices, use of parentheses, dashes, semicolons, and paragraph breaks.

7. RHETORICAL DEVICES: Identify any characteristic use of questions, analogies, repetition, or other stylistic techniques.

REWRITE INSTRUCTIONS:
- Maintain the original content and meaning of the input text
- Transform EVERY aspect of expression to match the style sample exactly
- Use the same sentence patterns, vocabulary level, tone, and flow as the sample
- Adopt the sample's characteristic way of connecting ideas and structuring arguments
- Mirror the sample's punctuation patterns and paragraph structure
- If the sample uses specific rhetorical devices, incorporate similar ones appropriately
- The result should sound like it was written by the same author as the style sample

`;

  if (hasContent) {
    prompt += `CONTENT INTEGRATION: Judiciously weave in relevant ideas, examples, and details from this reference material while maintaining the target style:\n"${params.contentMixText}"\n\n`;
  }

  // <<< PRESETS/APPLIED INSTRUCTIONS HERE >>>
  prompt += buildPresetBlock(params.selectedPresets, params.customInstructions);

  prompt += `INPUT TEXT TO REWRITE:\n"${params.inputText}"\n\nProduce only the rewritten text, maintaining the original meaning while fully adopting the style sample's characteristics:`;
  return prompt;
}

export interface RewriteParams {
  inputText: string;
  styleText?: string;
  contentMixText?: string;
  customInstructions?: string;
  selectedPresets?: string[];
  mixingMode?: 'style' | 'content' | 'both';
}

export class AIProviderService {
  async rewriteWithOpenAI(params: RewriteParams): Promise<string> {
    console.log("🔥 CALLING OPENAI API - Input length:", params.inputText?.length || 0);
    const prompt = buildRewritePrompt({
      inputText: params.inputText,
      styleText: params.styleText,
      contentMixText: params.contentMixText,
      selectedPresets: params.selectedPresets,
      customInstructions: params.customInstructions,
    });
    console.log("🔥 User prompt length:", prompt.length);
    
    try {
      console.log("🔥 About to make OpenAI API call...");
      const response = await openai.chat.completions.create({
        model: DEFAULT_OPENAI_MODEL,
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      console.log("🔥 OpenAI response received, length:", response.choices[0].message.content?.length || 0);
      return this.cleanMarkup(response.choices[0].message.content || "");
    } catch (error: any) {
      console.error("🔥 OpenAI API ERROR:", error);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async rewriteWithAnthropic(params: RewriteParams): Promise<string> {
    console.log("🔥 CALLING ANTHROPIC API - Input length:", params.inputText?.length || 0);
    const prompt = buildRewritePrompt({
      inputText: params.inputText,
      styleText: params.styleText,
      contentMixText: params.contentMixText,
      selectedPresets: params.selectedPresets,
      customInstructions: params.customInstructions,
    });
    console.log("🔥 User prompt length:", prompt.length);
    
    try {
      console.log("🔥 About to make Anthropic API call...");
      const response = await anthropic.messages.create({
        model: DEFAULT_ANTHROPIC_MODEL,
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      });

      console.log("🔥 Anthropic response received, length:", response.content[0].text?.length || 0);
      return this.cleanMarkup(response.content[0].text || "");
    } catch (error: any) {
      console.error("🔥 ANTHROPIC API ERROR:", error);
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }

  async rewriteWithPerplexity(params: RewriteParams): Promise<string> {
    const prompt = buildRewritePrompt({
      inputText: params.inputText,
      styleText: params.styleText,
      contentMixText: params.contentMixText,
      selectedPresets: params.selectedPresets,
      customInstructions: params.customInstructions,
    });
    
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY_ENV_VAR || "default_key"}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-small-128k-online",
          messages: [
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 4000,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Perplexity API error ${response.status}: ${errorText}`);
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.cleanMarkup(data.choices[0].message.content || "");
    } catch (error) {
      throw new Error(`Perplexity API error: ${error.message}`);
    }
  }

  async rewriteWithDeepSeek(params: RewriteParams): Promise<string> {
    const prompt = buildRewritePrompt({
      inputText: params.inputText,
      styleText: params.styleText,
      contentMixText: params.contentMixText,
      selectedPresets: params.selectedPresets,
      customInstructions: params.customInstructions,
    });
    
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY_ENV_VAR || "default_key"}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 4000,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.cleanMarkup(data.choices[0].message.content || "");
    } catch (error) {
      throw new Error(`DeepSeek API error: ${error.message}`);
    }
  }

  async rewrite(provider: string, params: RewriteParams): Promise<string> {
    // Define fallback order
    const providers = [provider, 'openai', 'anthropic', 'deepseek'];
    const uniqueProviders = [...new Set(providers)]; // Remove duplicates

    let lastError: Error | null = null;
    
    for (const currentProvider of uniqueProviders) {
      try {
        console.log(`Attempting rewrite with provider: ${currentProvider}`);
        
        switch (currentProvider) {
          case 'openai':
            return await this.rewriteWithOpenAI(params);
          case 'anthropic':
            return await this.rewriteWithAnthropic(params);
          case 'perplexity':
            return await this.rewriteWithPerplexity(params);
          case 'deepseek':
            return await this.rewriteWithDeepSeek(params);
          default:
            throw new Error(`Unsupported provider: ${currentProvider}`);
        }
      } catch (error) {
        console.log(`Provider ${currentProvider} failed:`, error.message);
        lastError = error;
        
        // If this is the last provider, throw the error
        if (currentProvider === uniqueProviders[uniqueProviders.length - 1]) {
          throw lastError;
        }
        
        // Otherwise, continue to next provider
        continue;
      }
    }
    
    throw lastError || new Error('All providers failed');
  }

  private cleanMarkup(text: string): string {
    return text
      // Remove markdown bold/italic markers
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
      // Remove markdown headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove inline code backticks
      .replace(/`([^`]+)`/g, '$1')
      // Remove code block markers
      .replace(/```[\s\S]*?```/g, (match) => {
        return match.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
      })
      // Remove other common markdown symbols
      .replace(/~~([^~]+)~~/g, '$1') // strikethrough
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
      .replace(/>\s+/gm, '') // blockquotes
      // Remove excessive whitespace and clean up
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

export const aiProviderService = new AIProviderService();