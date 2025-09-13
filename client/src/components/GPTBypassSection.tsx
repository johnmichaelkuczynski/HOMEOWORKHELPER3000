import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Zap, RefreshCw, Download, Eye, EyeOff, FileText, Copy, Trash2, FileDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_STYLE_SAMPLE = `There are two broad types of relationships: formal and functional. Formal relationships hold between descriptions. A description is any statement that can be true or false. Example of a formal relationship: The description that a shape is a square cannot be true unless the description that it has four equal sides is true. Therefore, a shape's being a square depends on its having four equal sides. Functional relationships hold between events or conditions. (An event is anything that happens in time.) Example of a functional relationship: A plant cannot grow without water. Therefore, a plant's growth depends on its receiving water. The first type is structural, i.e., it holds between statements about features. The second is operational, i.e., it holds between things in the world as they act or change. Descriptions as objects of consideration. The objects of evaluation are descriptions. Something is not evaluated unless it is described, and it is not described unless it can be stated. One can notice non-descriptions — sounds, objects, movements — but in the relevant sense one evaluates descriptions of them. Relationships not known through direct observation. Some relationships are known, not through direct observation, but through reasoning. Such relationships are structural, as opposed to observational. Examples of structural relationships are: If A, then A or B. All tools require some form of use. Nothing can be both moving and perfectly still. There are no rules without conditions. 1 obviously expresses a relationship; 2–4 do so less obviously, as their meanings are: 2*. A tool's being functional depends on its being usable. 3*. An object's being both moving and still depends on contradictory conditions, which cannot occur together. 4*. The existence of rules depends on the existence of conditions to which they apply. Structural truth and structural understanding. Structural understanding is always understanding of relationships. Observational understanding can be either direct or indirect; the same is true of structural understanding.`;

const HUME_INDUCTION_SAMPLE = `HUME, INDUCTION, AND THE LOGIC OF EXPLANATION 

We haven't yet refuted Hume's argument—we've only taken the first step towards doing so. Hume could defend his view against what we've said thus by far by saying the following: Suppose that, to explain why all phi's thus far known are psi's, you posit some underlying structure or law that disposes phi's to be psi's. Unless you think that nature is uniform, you have no right to expect that connection to continue to hold. But if, in order to deal with this, you suppose that nature is uniform, then you are arguing in a circle, since the uniformity of nature is itself an inductive principle. For an explanation to be good isn't for it to be correct. Sometimes the right explanations are bad ones. A story will make this clear. I'm on a bus. The bus driver is smiling. A mystery! 'What on Earth does he have to smile about?' I ask myself. His job is so boring, and his life must therefore be such a horror.' But then I remember that, just a minute ago, a disembarking passenger gave him fifty $100 bills as a tip. So I have my explanation: 'he just came into a lot of money.' But that explanation is terrible. Why? Because getting such a tip is so improbable that my explanation makes the datum more mysterious than it was before I had any explanation at all. Knowledge is conceptually articulated awareness. In order for me to know that my shoes are uncomfortably tight, I need to have the concepts shoe, tight, discomfort, etc. I do not need to have these concepts—or, arguably, any concepts—to be aware of the uncomfortable tightness in my shoes. My knowledge of that truth is a conceptualization of my awareness of that state of affairs. People who are the bottom of a hierarchy are far less likely to spurn that hierarchy than they are to use it against people who are trying to climb the ranks of that hierarchy. The person who never graduates from college may in some contexts claim that a college degree is worthless, but he is unlikely to act accordingly. When he comes across someone without a college degree who is trying to make something of himself, he is likely to pounce on that person, claiming he is an uncredentialed hack. The more useless a given employee is to the organization that employs her, the more unstintingly she will toe that organization's line. This is a corollary of the loser paradox. People don't give good reviews to writers who do not already have positive reviews. This is a veridical paradox, in the sense that it describes an actual vicious circle and does not represent a logical blunder. Communications technology is supposed to connect us but separates us into self-contained, non-interacting units. Solution: Communications technology is not supposed to connect us emotionally. On the contrary, it is supposed to connect us in such a way that we can transact without having to bond emotionally.`;

const EXPLANATORY_EFFICIENCY_SAMPLE = `Consider two alternative accounts of explanatory efficiency. The first says that an explanation is more efficient when it explains more with less. The second says that an explanation is more efficient when it explains the same amount with less. These accounts differ in what they take to be the relevant baseline for comparison. The first account compares explanations that use the same resources but explain different amounts. The second compares explanations that explain the same amount but use different resources. Both accounts are plausible, but they can conflict. An explanation might be more efficient by the first account but less efficient by the second. This suggests that explanatory efficiency is not a univocal concept. Rather, there are different dimensions along which explanations can be more or less efficient. Understanding these dimensions is important for evaluating competing explanations and for developing better explanatory practices.`;

const RATIONAL_BELIEF_SAMPLE = `Rational belief requires more than just having good evidence. It also requires that one's beliefs hang together in a coherent way. A person might have excellent evidence for each of their individual beliefs, but if those beliefs contradict each other, then the person is not fully rational. This points to a structural constraint on rational belief: one's beliefs must form a consistent set. But consistency is not enough. Rational belief also requires that one's beliefs be appropriately connected to each other. If I believe that it's raining and I believe that the streets get wet when it rains, then I should also believe that the streets are wet. This points to another structural constraint: one's beliefs must be closed under obvious logical consequences. These structural constraints on rational belief are as important as evidential constraints, but they are often overlooked in discussions of rationality.`;

const RAVEN_PARADOX_SAMPLE = `The raven paradox presents a puzzle about confirmation. Consider the hypothesis "All ravens are black." We can confirm this hypothesis by observing black ravens. But the hypothesis is logically equivalent to "All non-black things are non-ravens." And we can confirm this equivalent hypothesis by observing non-black non-ravens, such as white shoes or red apples. This suggests that observing a white shoe confirms that all ravens are black, which seems absurd. The paradox arises because we have conflicting intuitions about confirmation. On one hand, we think that logically equivalent hypotheses should be confirmed by the same evidence. On the other hand, we think that only ravens (or perhaps only black things) are relevant to confirming hypotheses about ravens. Resolving the paradox requires clarifying what we mean by confirmation and what counts as relevant evidence.`;

const HETEROLOGICAL_PARADOX_SAMPLE = `Heterological Paradox: A word is 'heterological' if it is false of itself. Thus 'monosyllabic' is heterological, whereas 'polysyllabic' is not heterological. Question: Is 'heterological' heterological? It is if it isn't and if isn't if it is. Solution: To say that 'polysyllabic' is true of itself is to say that 'polysyllabic' is polysyllabic. To say that 'is an English expression' is true of itself is to say that 'is an English expression' is an English expression. 'True of itself,' when meaningful, simply abbreviates some non-reflexive construction; and when it doesn't do so, the term 'self' an undefined pronoun—a free variable, in other words.`;

const LIAR_PARADOX_SAMPLE = `The Liar Paradox: Suppose Smith says "I am lying." He is lying if he's telling the truth and he's telling the truth if he's lying. Analysis: It is not words per se but the underlying meanings, or propositions, that are true or false. So when Smith says "I am lying", what he is saying, if stated perspicuously, is to the effect that: There exists a proposition P such that P is false if affirmed and true if denied and such that, moreover, I am not affirming P. But the statement just made is neither false-if-true nor true-if-false: it is simply false.`;

const BERRY_PARADOX_SAMPLE = `Berry's Paradox: The expression "the first number not nameable in under ten words" names that number in nine words. Solution: There are different ways of picking out a number. The canonical way of doing so is by using the usual numerical notation. Thus, the expression "117,334" is the canonical way of picking out the corresponding number, but "the exact number of dollars in Jim's saving's account" is not. In light of this, let n be the least number that cannot be canonically picked out in less than ten words. Given that E is not a canonical description of n, there is nothing paradoxical about the fact that E picks out n.`;

const WITTGENSTEIN_PARADOX_SAMPLE = `Wittgenstein's Rule-following Paradox: Any given course of conduct complies with many different rules, and there is therefore no good reason to say of a given act that it is an act of following this as opposed to that rule. So any putative case of following a given rule might equally reasonably be seen as a case of following some other, incompatible rule, and there is therefore no good reason to regard any act as a case of following any given rule. The solution: Taken in isolation, a given action can be interpreted as an act of compliance with any given one of a plurality of incompatible rules. If you say "4" when I ask you "what is 2+2?", I cannot on the basis alone rule out the possibility that you took "what is 2+2?" and "4" to mean, respectively, "I want to play chess" and "I do not have time for childish pastimes." But if that is what you meant, there will be independent evidence for it. So Wittgenstein's 'paradox' collapses into the trivial point that erroneous hypotheses may be compatible with artificially restricted data sets.`;

const SORITES_PARADOX_SAMPLE = `The Sorites Paradox: A single grain of sand is not a heap. If n grains of sand, then neither are n+1 grains. Therefore, a billion grains of sands are not a heap. Analysis: Three grains of sand is more of a heap than two; four are more of a heap than three. n+1 grains of sand are more 'heapy' than n grains. If, for arbitrary n, n grains of sand qualify as a heap, they do so because they are heapy enough relative to some benchmark. They may be heapy enough to alter the path of a rolling golf ball or they may be heapy enough to block traffic. In general, Sorites paradoxes are solved by replacing binary characterizations ('heap', 'rich', 'part of a given cloud') with the corresponding comparatives ('more of a heap', 'rich', 'more a part of that cloud'), along with the contextually supplied benchmarks.`;

const MILLET_PARADOX_SAMPLE = `The Paradox of the Grain of Millet: If a single grain of millet falls to the earth, it doesn't make a sound. But if a billion such grains do so, they do make a sound. Therefore, a billion nothings add up to something. Analysis: If a given grain of millet falls to the earth, it does make a sound. If you were millet-sized and appropriately located in relation to the millet grains impact with the earth, the sound would be intolerably loud. To say that a single millet-grain doesn't make a sound when it hits the earth is comparable to saying that your stereo doesn't make a sound because your deaf grandfather can't hear it.`;

const getSampleText = (sampleId: string): string => {
  switch (sampleId) {
    case 'formal-functional':
      return DEFAULT_STYLE_SAMPLE;
    case 'hume-induction':
      return HUME_INDUCTION_SAMPLE;
    case 'explanatory-efficiency':
      return EXPLANATORY_EFFICIENCY_SAMPLE;
    case 'rational-belief':
      return RATIONAL_BELIEF_SAMPLE;
    case 'raven-paradox':
      return RAVEN_PARADOX_SAMPLE;
    case 'heterological-paradox':
      return HETEROLOGICAL_PARADOX_SAMPLE;
    case 'liar-paradox':
      return LIAR_PARADOX_SAMPLE;
    case 'berry-paradox':
      return BERRY_PARADOX_SAMPLE;
    case 'wittgenstein-paradox':
      return WITTGENSTEIN_PARADOX_SAMPLE;
    case 'sorites-paradox':
      return SORITES_PARADOX_SAMPLE;
    case 'millet-paradox':
      return MILLET_PARADOX_SAMPLE;
    default:
      return DEFAULT_STYLE_SAMPLE;
  }
};

// Top 8 most important humanization techniques (1-8)
const TOP_PRESETS = [
  { id: "mixed-cadence-sprawl", name: "1. Mixed cadence + clause sprawl", description: "Alternate short and long sentences; allow some long sentences to wander with extra clauses." },
  { id: "asymmetric-emphasis", name: "2. Asymmetric emphasis", description: "Over-elaborate one point; compress or skate past another." },
  { id: "one-aside", name: "3. One aside", description: "Add a quick parenthetical or em-dash remark — factual, not jokey." },
  { id: "hedge-twice", name: "4. Hedge twice", description: "Use two mild uncertainty markers ('probably,' 'seems,' 'roughly,' 'I think')." },
  { id: "local-disfluency", name: "5. Local disfluency", description: "Keep one redundant or slightly awkward phrase that still makes sense." },
  { id: "analogy-injection", name: "6. Analogy injection", description: "Insert a short, concrete comparison to something unrelated but illustrative." },
  { id: "topic-snap", name: "7. Topic snap", description: "Abruptly shift focus once, then return." },
  { id: "friction-detail", name: "8. Friction detail", description: "Drop in a small, seemingly unnecessary but real-world-plausible detail." },
];

// Additional style presets
const STYLE_PRESETS = [
  { id: "compression-light", name: "Compression — light (−15%)", description: "Cut filler; merge short clauses; keep meaning." },
  { id: "compression-medium", name: "Compression — medium (−30%)", description: "Trim hard; delete throat-clearing; tighten syntax." },
  { id: "compression-heavy", name: "Compression — heavy (−45%)", description: "Sever redundancies; collapse repeats; keep core claims." },
  { id: "decrease-50", name: "DECREASE BY 50%", description: "REDUCE THE LENGTH BY HALF WHILE PRESERVING MEANING" },
  { id: "increase-150", name: "INCREASE BY 150%", description: "EXPAND THE TEXT TO 150% LONGER WITH ADDITIONAL DETAIL AND ELABORATION" },
  { id: "mixed-cadence", name: "Mixed cadence", description: "Alternate 5–35-word sentences; no uniform rhythm." },
  { id: "clause-surgery", name: "Clause surgery", description: "Reorder main/subordinate clauses in 30% of sentences." },
  { id: "front-load-claim", name: "Front-load claim", description: "Put the main conclusion in sentence 1; support follows." },
  { id: "back-load-claim", name: "Back-load claim", description: "Delay the conclusion to the final 2–3 sentences." },
  { id: "seam-pivot", name: "Seam/pivot", description: "Drop smooth connectors once; abrupt turn is fine." },
  { id: "imply-one-step", name: "Imply one step", description: "Omit an obvious inferential step; leave it implicit." },
  { id: "conditional-framing", name: "Conditional framing", description: "Recast one key sentence as 'If/Unless …, then …'." },
  { id: "local-contrast", name: "Local contrast", description: "Use 'but/except/aside' once to mark a boundary—no new facts." },
  { id: "scope-check", name: "Scope check", description: "Replace one absolute with a bounded form ('in cases like these')." },
  { id: "deflate-jargon", name: "Deflate jargon", description: "Swap nominalizations for verbs where safe (e.g., 'utilization' → 'use')." },
  { id: "kill-stock-transitions", name: "Kill stock transitions", description: "Delete 'Moreover/Furthermore/In conclusion' everywhere." },
  { id: "hedge-once", name: "Hedge once", description: "Use exactly one: 'probably/roughly/more or less.'" },
  { id: "drop-intensifiers", name: "Drop intensifiers", description: "Remove 'very/clearly/obviously/significantly.'" },
  { id: "low-heat-voice", name: "Low-heat voice", description: "Prefer plain verbs; avoid showy synonyms." },
  { id: "concrete-benchmark", name: "Concrete benchmark", description: "Replace one vague scale with a testable one (e.g., 'enough to X')." },
  { id: "swap-generic-example", name: "Swap generic example", description: "If the source has an example, make it slightly more specific; else skip." },
  { id: "metric-nudge", name: "Metric nudge", description: "Replace 'more/better' with a minimal, source-safe comparator ('more than last case')." },
  { id: "cull-repeats", name: "Cull repeats", description: "Delete duplicated sentences/ideas; keep the strongest instance." },
  { id: "no-lists", name: "No lists", description: "Force continuous prose; remove bullets/numbering." },
  { id: "no-meta", name: "No meta", description: "No prefaces, apologies, or 'as requested' scaffolding." },
  { id: "exact-nouns", name: "Exact nouns", description: "Replace vague pronouns where antecedent is ambiguous." },
  { id: "quote-once", name: "Quote once", description: "If the source contains a strong phrase, quote it once; else skip." },
  { id: "claim-lock", name: "Claim lock", description: "Do not add examples, scenarios, or data not present in the source." },
  { id: "entity-lock", name: "Entity lock", description: "Keep names, counts, and attributions exactly as given." },
  { id: "lean-sharp", name: "Lean & Sharp", description: "Compression-medium + mixed cadence + imply one step + kill stock transitions." },
  { id: "analytic", name: "Analytic", description: "Clause surgery + front-load claim + scope check + exact nouns + no lists." },
];

const WRITING_SAMPLES = [
  { id: "formal-functional", name: "FORMAL AND FUNCTIONAL RELATIONSHIPS", category: "Content-Neutral" },
  { id: "explanatory-efficiency", name: "ALTERNATIVE ACCOUNT OF EXPLANATORY EFFICIENCY", category: "Content-Neutral" },
  { id: "rational-belief", name: "RATIONAL BELIEF AND UNDERLYING STRUCTURE", category: "Epistemology" },
  { id: "raven-paradox", name: "THE RAVEN PARADOX", category: "Paradoxes" },
  { id: "hume-induction", name: "HUME, INDUCTION, AND THE LOGIC OF EXPLANATION", category: "Philosophy" },
  { id: "heterological-paradox", name: "HETEROLOGICAL PARADOX", category: "Paradoxes" },
  { id: "liar-paradox", name: "THE LIAR PARADOX", category: "Paradoxes" },
  { id: "berry-paradox", name: "BERRY'S PARADOX", category: "Paradoxes" },
  { id: "wittgenstein-paradox", name: "WITTGENSTEIN'S RULE-FOLLOWING PARADOX", category: "Philosophy" },
  { id: "sorites-paradox", name: "THE SORITES PARADOX", category: "Paradoxes" },
  { id: "millet-paradox", name: "THE PARADOX OF THE GRAIN OF MILLET", category: "Paradoxes" },
];

const AI_PROVIDERS = [
  { id: "anthropic", name: "ZHI 1" },
  { id: "openai", name: "ZHI 2" },
  { id: "deepseek", name: "ZHI 3" },
  { id: "perplexity", name: "ZHI 4" },
];

interface GPTBypassSectionProps {
  onSendToHomework?: (text: string) => void;
  receivedHomeworkText?: string;
}

interface TextChunk {
  id: number;
  text: string;
  wordCount: number;
  selected: boolean;
  aiScore?: number | null;
  outputText?: string;
  outputAiScore?: number | null;
  isProcessing?: boolean;
}

export default function GPTBypassSection({ onSendToHomework, receivedHomeworkText }: GPTBypassSectionProps) {
  const [inputText, setInputText] = useState("");
  const [styleText, setStyleText] = useState(DEFAULT_STYLE_SAMPLE);
  const [outputText, setOutputText] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("anthropic");
  const [selectedSample, setSelectedSample] = useState("formal-functional");
  const [inputAiScore, setInputAiScore] = useState<number | null>(null);
  const [outputAiScore, setOutputAiScore] = useState<number | null>(null);
  const [previewSample, setPreviewSample] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [isChunkedMode, setIsChunkedMode] = useState(false);
  
  const inputFileRef = useRef<HTMLInputElement>(null);
  const styleFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Auto-populate Box A with homework text
  useEffect(() => {
    if (receivedHomeworkText) {
      setInputText(receivedHomeworkText);
    }
  }, [receivedHomeworkText]);

  // Auto-analyze input text when it changes and create chunks if needed
  useEffect(() => {
    if (inputText.trim()) {
      const wordCount = inputText.trim().split(/\s+/).length;
      
      // Enable chunked mode for texts longer than 800 words
      if (wordCount > 800) {
        setIsChunkedMode(true);
        createChunks(inputText);
      } else {
        setIsChunkedMode(false);
        setChunks([]);
        if (!isAnalyzing) {
          analyzeText(inputText, 'input');
        }
      }
    } else {
      setIsChunkedMode(false);
      setChunks([]);
      setInputAiScore(null);
    }
  }, [inputText]);

  // Auto-analyze output text when it changes  
  useEffect(() => {
    if (outputText.trim() && !isAnalyzing) {
      analyzeText(outputText, 'output');
    }
  }, [outputText]);

  // Update style text when sample is selected
  useEffect(() => {
    if (selectedSample !== 'custom') {
      setStyleText(getSampleText(selectedSample));
    }
  }, [selectedSample]);

  const analyzeText = async (text: string, type: 'input' | 'output') => {
    if (!text.trim()) return;
    
    try {
      setIsAnalyzing(true);
      const response = await fetch('/api/humanize/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) {
        throw new Error('Analysis failed');
      }
      
      const result = await response.json();
      
      if (type === 'input') {
        setInputAiScore(result.aiScore);
      } else {
        setOutputAiScore(result.aiScore);
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, target: 'input' | 'style') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/humanize/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('File upload failed');
      }

      const processedFile = await response.json();
      
      if (target === 'input') {
        setInputText(processedFile.content);
      } else {
        setStyleText(processedFile.content);
        setSelectedSample('custom');
      }
      
      toast({
        title: "File uploaded",
        description: `Extracted ${processedFile.wordCount} words from ${processedFile.filename}`,
      });
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Upload failed",
        description: "Could not process the uploaded file",
        variant: "destructive",
      });
    }
  };

  const handleRewrite = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Input required",
        description: "Please enter text to humanize in Box A",
        variant: "destructive",
      });
      return;
    }

    if (isChunkedMode) {
      await handleChunkedRewrite();
    } else {
      await handleSingleRewrite();
    }
  };

  const handleSingleRewrite = async () => {
    setIsProcessing(true);
    setOutputText("");
    setOutputAiScore(null);

    try {
      const response = await fetch('/api/humanize/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText,
          styleText: styleText || undefined,
          customInstructions: customInstructions || undefined,
          selectedPresets: selectedPresets.length > 0 ? selectedPresets : undefined,
          provider: selectedProvider,
          mixingMode: 'style',
        }),
      });

      if (!response.ok) {
        throw new Error('Rewriting failed');
      }

      const result = await response.json();
      setOutputText(result.rewrittenText);
      setInputAiScore(result.inputAiScore);
      setOutputAiScore(result.outputAiScore);
      
      const scoreImprovement = result.inputAiScore - result.outputAiScore;
      toast({
        title: "Text humanized successfully",
        description: `AI score: ${result.inputAiScore}% → ${result.outputAiScore}% (${scoreImprovement > 0 ? '-' : '+'}${Math.abs(scoreImprovement).toFixed(1)}%)`,
      });
    } catch (error) {
      console.error('Rewriting error:', error);
      toast({
        title: "Humanization failed",
        description: "Could not humanize the text. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChunkedRewrite = async () => {
    const selectedChunks = chunks.filter(chunk => chunk.selected);
    
    if (selectedChunks.length === 0) {
      toast({
        title: "No chunks selected",
        description: "Please select at least one chunk to process",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    // Clear output text before starting chunked processing
    setOutputText("");
    setOutputAiScore(null);
    
    try {
      let processedResults: any[] = [];
      
      // Process chunks sequentially to avoid overwhelming the API
      for (const chunk of selectedChunks) {
        setChunks(prev => prev.map(c => 
          c.id === chunk.id ? { ...c, isProcessing: true } : c
        ));

        const response = await fetch('/api/humanize/rewrite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputText: chunk.text,
            styleText: styleText || undefined,
            customInstructions: customInstructions || undefined,
            selectedPresets: selectedPresets.length > 0 ? selectedPresets : undefined,
            provider: selectedProvider,
            mixingMode: 'style',
          }),
        });

        if (!response.ok) {
          throw new Error(`Rewriting failed for chunk ${chunk.id}`);
        }

        const result = await response.json();
        
        // Update chunk state
        setChunks(prev => prev.map(c => 
          c.id === chunk.id ? { 
            ...c, 
            outputText: result.rewrittenText,
            outputAiScore: result.outputAiScore,
            isProcessing: false
          } : c
        ));

        // IMMEDIATELY deposit this chunk's result to output text box
        processedResults.push({
          text: result.rewrittenText,
          aiScore: result.outputAiScore
        });
        
        // Update output text in real-time - append each chunk as it completes
        const combinedOutput = processedResults.map(r => r.text).join('\n\n');
        setOutputText(combinedOutput);
        
        // Update AI score in real-time - calculate running average
        const validScores = processedResults.filter(r => r.aiScore !== null).map(r => r.aiScore);
        if (validScores.length > 0) {
          const avgScore = Math.round(validScores.reduce((sum: number, score: number) => sum + score, 0) / validScores.length);
          setOutputAiScore(avgScore);
        }

        // Small delay between chunks to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast({
        title: "Chunks processed successfully",
        description: `${selectedChunks.length} chunks have been humanized`,
      });
    } catch (error) {
      console.error('Chunked rewriting error:', error);
      toast({
        title: "Humanization failed",
        description: "Could not humanize the selected chunks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      // Reset processing state for all chunks
      setChunks(prev => prev.map(chunk => ({ ...chunk, isProcessing: false })));
    }
  };

  const handleReRewrite = async () => {
    if (!outputText.trim()) {
      toast({
        title: "No output to re-humanize",
        description: "Generate a rewrite first",
        variant: "destructive",
      });
      return;
    }

    setInputText(outputText);
    setOutputText("");
    setOutputAiScore(null);
    
    setTimeout(handleRewrite, 100);
  };

  const handlePresetToggle = (presetId: string) => {
    setSelectedPresets(prev =>
      prev.includes(presetId)
        ? prev.filter(id => id !== presetId)
        : [...prev, presetId]
    );
  };

  const getAIScoreColor = (score: number) => {
    if (score >= 80) return "text-red-600 font-bold";
    if (score >= 50) return "text-yellow-600 font-bold";
    if (score >= 20) return "text-blue-600 font-bold";
    return "text-green-600 font-bold";
  };

  const getAIScoreText = (score: number) => {
    return `${score}% AI / ${100 - score}% HUMAN`;
  };

  // Word count calculation helper
  const getWordCount = (text: string): number => {
    if (!text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  };

  // Chunking functions
  const createChunks = (text: string) => {
    const words = text.trim().split(/\s+/);
    const chunks: TextChunk[] = [];
    let chunkId = 1;
    
    for (let i = 0; i < words.length; i += 700) {
      const chunkWords = words.slice(i, i + 700);
      const chunkText = chunkWords.join(' ');
      
      chunks.push({
        id: chunkId++,
        text: chunkText,
        wordCount: chunkWords.length,
        selected: true, // Default to selected
        aiScore: null,
        outputText: '',
        outputAiScore: null,
        isProcessing: false,
      });
    }
    
    setChunks(chunks);
    
    // Analyze first few chunks initially
    chunks.slice(0, 3).forEach(chunk => {
      analyzeChunk(chunk.id, chunk.text);
    });
  };

  const analyzeChunk = async (chunkId: number, text: string) => {
    if (!text.trim()) return;
    
    try {
      const response = await fetch('/api/humanize/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) {
        throw new Error('Analysis failed');
      }
      
      const result = await response.json();
      
      setChunks(prev => prev.map(chunk => 
        chunk.id === chunkId ? { ...chunk, aiScore: result.aiScore } : chunk
      ));
    } catch (error) {
      console.error(`Analysis error for chunk ${chunkId}:`, error);
    }
  };

  const toggleChunkSelection = (chunkId: number) => {
    setChunks(prev => prev.map(chunk => 
      chunk.id === chunkId ? { ...chunk, selected: !chunk.selected } : chunk
    ));
  };

  const selectAllChunks = () => {
    setChunks(prev => prev.map(chunk => ({ ...chunk, selected: true })));
  };

  const selectNoneChunks = () => {
    setChunks(prev => prev.map(chunk => ({ ...chunk, selected: false })));
  };

  // Copy/Delete functions for Box A
  const copyInputText = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Nothing to copy",
        description: "Box A is empty",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await navigator.clipboard.writeText(inputText);
      toast({
        title: "Copied to clipboard",
        description: "Box A text copied successfully",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy text to clipboard",
        variant: "destructive",
      });
    }
  };

  const deleteInputText = () => {
    setInputText("");
    setInputAiScore(null);
    toast({
      title: "Box A cleared",
      description: "Input text deleted",
    });
  };

  // Copy/Delete functions for Box B
  const copyStyleText = async () => {
    if (!styleText.trim()) {
      toast({
        title: "Nothing to copy",
        description: "Box B is empty",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await navigator.clipboard.writeText(styleText);
      toast({
        title: "Copied to clipboard",
        description: "Box B style sample copied successfully",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy text to clipboard",
        variant: "destructive",
      });
    }
  };

  const deleteStyleText = () => {
    setStyleText("");
    toast({
      title: "Box B cleared",
      description: "Style sample deleted",
    });
  };

  // Download functions for Box C
  const downloadAsText = () => {
    if (!outputText.trim()) {
      toast({
        title: "Nothing to download",
        description: "Box C is empty",
        variant: "destructive",
      });
      return;
    }

    const blob = new Blob([outputText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'humanized_text.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded",
      description: "Text file downloaded successfully",
    });
  };

  const downloadAsWord = () => {
    if (!outputText.trim()) {
      toast({
        title: "Nothing to download",
        description: "Box C is empty",
        variant: "destructive",
      });
      return;
    }

    // Create simple RTF format that Word can open
    const rtfContent = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}} \\f0\\fs24 ${outputText.replace(/\n/g, '\\line ')}}`;
    const blob = new Blob([rtfContent], { type: 'application/rtf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'humanized_text.rtf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded",
      description: "Word file downloaded successfully",
    });
  };

  const downloadAsPDF = async () => {
    if (!outputText.trim()) {
      toast({
        title: "Nothing to download",
        description: "Box C is empty",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: outputText,
          title: 'Humanized Text',
        }),
      });

      if (!response.ok) {
        throw new Error('PDF generation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'humanized_text.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Downloaded",
        description: "PDF downloaded successfully",
      });
    } catch (error) {
      console.error('PDF download error:', error);
      toast({
        title: "PDF download failed",
        description: "Could not generate PDF. Try downloading as text instead.",
        variant: "destructive",
      });
    }
  };

  // Send output to homework assignment details
  const sendToHomework = () => {
    if (!outputText.trim()) {
      toast({
        title: "Nothing to send",
        description: "Box C is empty",
        variant: "destructive",
      });
      return;
    }

    if (onSendToHomework) {
      onSendToHomework(outputText);
      toast({
        title: "Sent to homework",
        description: "Text sent to Assignment Details box",
      });
    }
  };

  // Get combined stats for chunked mode
  const getChunkedStats = () => {
    if (chunks.length === 0) return null;
    
    const selectedCount = chunks.filter(chunk => chunk.selected).length;
    const processedCount = chunks.filter(chunk => chunk.outputText).length;
    const totalWords = chunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);
    
    return {
      totalChunks: chunks.length,
      selectedCount,
      processedCount,
      totalWords
    };
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6" data-testid="gpt-bypass-section">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Zap className="h-6 w-6" />
            GPT BYPASS - AI Text Humanizer
          </CardTitle>
        </CardHeader>
        <CardContent>
          
          {/* Main 3-Box Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            
            {/* BOX A: Input Text */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-bold text-blue-700">
                  BOX A: Input Text
                  {isChunkedMode && (
                    <span className="text-sm font-normal text-slate-600 ml-2">
                      ({chunks.length} chunks, {getChunkedStats()?.totalWords} words)
                    </span>
                  )}
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyInputText}
                    data-testid="button-copy-input-header"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deleteInputText}
                    data-testid="button-delete-input-header"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                  {inputAiScore !== null && !isChunkedMode && (
                    <Badge variant="outline" className={getAIScoreColor(inputAiScore)}>
                      {getAIScoreText(inputAiScore)}
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Chunk Selection Controls */}
              {isChunkedMode && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800">
                      Select chunks to process ({getChunkedStats()?.selectedCount} of {chunks.length} selected)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={selectAllChunks}
                        data-testid="button-select-all-chunks"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={selectNoneChunks}
                        data-testid="button-select-none-chunks"
                      >
                        Select None
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                    {chunks.map((chunk) => (
                      <div key={chunk.id} className="flex items-center space-x-2 text-sm">
                        <Checkbox
                          id={`chunk-${chunk.id}`}
                          checked={chunk.selected}
                          onCheckedChange={() => toggleChunkSelection(chunk.id)}
                          data-testid={`checkbox-chunk-${chunk.id}`}
                        />
                        <Label htmlFor={`chunk-${chunk.id}`} className="cursor-pointer flex-1">
                          Chunk {chunk.id} ({chunk.wordCount} words)
                          {chunk.aiScore !== null && (
                            <Badge variant="outline" className={`ml-2 text-xs ${getAIScoreColor(chunk.aiScore)}`}>
                              {chunk.aiScore}%
                            </Badge>
                          )}
                          {chunk.isProcessing && (
                            <span className="ml-2 text-blue-600">
                              <RefreshCw className="h-3 w-3 inline animate-spin" /> Processing...
                            </span>
                          )}
                          {chunk.outputText && (
                            <span className="ml-2 text-green-600">✓ Completed</span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => inputFileRef.current?.click()}
                  data-testid="button-upload-input"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyInputText}
                  data-testid="button-copy-input"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deleteInputText}
                  data-testid="button-delete-input"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
              <Textarea
                placeholder="Paste your AI-generated text here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className={`${isChunkedMode ? 'min-h-[300px]' : 'min-h-[500px]'} text-sm resize-none`}
                data-testid="input-text"
              />
              <input
                ref={inputFileRef}
                type="file"
                accept=".txt,.docx,.pdf"
                onChange={(e) => handleFileUpload(e, 'input')}
                className="hidden"
              />
            </div>

            {/* BOX B: Style Sample */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-bold text-green-700">
                  BOX B: Style Sample
                  <span className="text-sm font-normal text-slate-600 ml-2">
                    ({getWordCount(styleText)} words)
                  </span>
                </Label>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => styleFileRef.current?.click()}
                  data-testid="button-upload-style"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyStyleText}
                  data-testid="button-copy-style"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deleteStyleText}
                  data-testid="button-delete-style"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
              <Textarea
                placeholder="Writing sample to clone style from..."
                value={styleText}
                onChange={(e) => {
                  setStyleText(e.target.value);
                  setSelectedSample('custom');
                }}
                className="min-h-[500px] text-sm resize-none"
                data-testid="style-text"
              />
              <input
                ref={styleFileRef}
                type="file"
                accept=".txt,.docx,.pdf"
                onChange={(e) => handleFileUpload(e, 'style')}
                className="hidden"
              />
            </div>

            {/* BOX C: Output */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-bold text-purple-700">
                  BOX C: Humanized Output
                  <span className="text-sm font-normal text-slate-600 ml-2">
                    ({getWordCount(outputText)} words)
                  </span>
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!outputText.trim()) {
                        toast({
                          title: "Nothing to copy",
                          description: "Box C is empty",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      try {
                        await navigator.clipboard.writeText(outputText);
                        toast({
                          title: "Copied to clipboard",
                          description: "Box C text copied successfully",
                        });
                      } catch (error) {
                        toast({
                          title: "Copy failed",
                          description: "Could not copy text to clipboard",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid="button-copy-output-header"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOutputText("");
                      setOutputAiScore(null);
                      toast({
                        title: "Box C cleared",
                        description: "Output text deleted",
                      });
                    }}
                    data-testid="button-delete-output-header"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                  {outputAiScore !== null && (
                    <Badge variant="outline" className={getAIScoreColor(outputAiScore)}>
                      {getAIScoreText(outputAiScore)}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {outputText && (
                  <Button
                    onClick={handleReRewrite}
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    data-testid="button-re-humanize"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    RE-HUMANIZE
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadAsText}
                  data-testid="button-download-txt"
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  TXT
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadAsWord}
                  data-testid="button-download-word"
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Word
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadAsPDF}
                  data-testid="button-download-pdf"
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  PDF
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={sendToHomework}
                  data-testid="button-send-homework"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Send to Homework
                </Button>
              </div>
              <Textarea
                placeholder="Humanized text will appear here..."
                value={outputText}
                onChange={(e) => setOutputText(e.target.value)}
                className="min-h-[500px] text-sm resize-none"
                data-testid="output-text"
                readOnly={isProcessing}
              />
            </div>
          </div>

          {/* Custom Instructions Box */}
          <div className="mb-6">
            <Label className="text-lg font-medium mb-2 block">Custom Instructions</Label>
            <Textarea
              placeholder="Enter specific instructions for how the rewrite should be done..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              className="min-h-[120px] text-sm"
              data-testid="custom-instructions"
            />
          </div>

          {/* Left Side Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Writing Samples Dropdown */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-medium">Writing Sample</Label>
                {selectedSample !== 'custom' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPreviewSample(selectedSample);
                      setIsPreviewOpen(true);
                    }}
                    data-testid="button-preview-selected"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                )}
              </div>
              <Select value={selectedSample} onValueChange={setSelectedSample}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Upload Custom Sample</SelectItem>
                  {WRITING_SAMPLES.map((sample) => (
                    <SelectItem key={sample.id} value={sample.id}>
                      {sample.name} ({sample.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {previewSample && WRITING_SAMPLES.find(s => s.id === previewSample)?.name}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="mt-4">
                    <Textarea
                      value={previewSample ? getSampleText(previewSample) : ""}
                      readOnly
                      className="min-h-[400px] text-sm resize-none"
                      data-testid="preview-text"
                    />
                    <div className="flex justify-end gap-2 mt-4">
                      <Button
                        onClick={() => {
                          if (previewSample) {
                            setSelectedSample(previewSample);
                            setIsPreviewOpen(false);
                          }
                        }}
                        data-testid="button-use-sample"
                      >
                        Use This Sample
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsPreviewOpen(false)}
                        data-testid="button-close-preview"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* AI Provider Selection */}
              <div className="mt-4">
                <Label className="text-lg font-medium">AI Provider</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className="w-full mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Main Action Button */}
              <Button
                onClick={handleRewrite}
                disabled={!inputText.trim() || isProcessing}
                size="lg"
                className="w-full mt-4"
                data-testid="button-humanize"
              >
                {isProcessing ? (
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-5 w-5 mr-2" />
                )}
                {isProcessing ? "HUMANIZING..." : "HUMANIZE TEXT"}
              </Button>
            </div>

            {/* Humanization Techniques */}
            <div className="space-y-4">
              <Label className="text-lg font-medium">Humanization Techniques</Label>
              
              {/* Top 8 Most Effective */}
              <div className="border rounded p-4 bg-green-50">
                <h4 className="text-sm font-semibold text-green-700 mb-3">🔥 MOST EFFECTIVE (1-8)</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {TOP_PRESETS.map((preset) => (
                    <div key={preset.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={preset.id}
                        checked={selectedPresets.includes(preset.id)}
                        onCheckedChange={() => handlePresetToggle(preset.id)}
                        data-testid={`checkbox-preset-${preset.id}`}
                        className="mt-1"
                      />
                      <div className="grid gap-1 leading-none">
                        <Label
                          htmlFor={preset.id}
                          className="text-sm font-medium text-green-700 cursor-pointer"
                        >
                          {preset.name}
                        </Label>
                        <p className="text-xs text-green-600">
                          {preset.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Style Presets */}
              <div className="border rounded p-4">
                <h4 className="text-sm font-semibold text-blue-600 mb-3">Additional Style Tweaks</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {STYLE_PRESETS.map((preset) => (
                    <div key={preset.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={preset.id}
                        checked={selectedPresets.includes(preset.id)}
                        onCheckedChange={() => handlePresetToggle(preset.id)}
                        data-testid={`checkbox-preset-${preset.id}`}
                        className="mt-1"
                      />
                      <div className="grid gap-1 leading-none">
                        <Label
                          htmlFor={preset.id}
                          className="text-xs font-medium cursor-pointer"
                        >
                          {preset.name}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {preset.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Score Comparison */}
          {inputAiScore !== null && outputAiScore !== null && (
            <div className="mt-6 border rounded p-4 bg-gray-50">
              <h4 className="text-sm font-semibold mb-2">AI Detection Results</h4>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span>Input: <span className={getAIScoreColor(inputAiScore)}>{getAIScoreText(inputAiScore)}</span></span>
                  <span>→</span>
                  <span>Output: <span className={getAIScoreColor(outputAiScore)}>{getAIScoreText(outputAiScore)}</span></span>
                </div>
                <Badge variant="outline" className="font-bold">
                  Change: {inputAiScore > outputAiScore ? '-' : '+'}{Math.abs(inputAiScore - outputAiScore).toFixed(1)}%
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}