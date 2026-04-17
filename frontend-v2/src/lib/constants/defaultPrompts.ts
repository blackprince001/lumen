import { DocumentText as FileText, SearchNormal as Search, Profile as Baby, Lamp as Lightbulb, Eye, Microscope, Global, Notepad } from 'iconsax-reactjs';

export interface DefaultPrompt {
  id: string;
  label: string;
  icon: typeof FileText;
  content: string;
  description: string;
}

export const defaultPrompts: DefaultPrompt[] = [
  {
    id: 'summarize',
    label: 'Review & Summarize',
    icon: FileText,
    description: "Get a comprehensive summary of the paper's key points",
    content:
      "Please provide a comprehensive summary of this paper. Start with a one-sentence hook stating the paper's main contribution. Then, break down the key findings, methodology, and conclusions into bullet points. Finally, assess the paper's strengths and limitations.",
  },
  {
    id: 'critique',
    label: 'Critique Methodology',
    icon: Search,
    description: 'Analyze the research design and potential biases',
    content:
      "Analyze the methodology section of this paper. Identify the research design, data collection methods, and analytical techniques used. How effective are these methods for addressing the research question? Are there any potential biases or limitations in the study design that the authors didn't address?",
  },
  {
    id: 'eli5',
    label: "Explain Like I'm 5",
    icon: Baby,
    description: 'Simple explanation of core concepts',
    content:
      "Explain the core concept of this paper as if I were a 5-year-old. Use simple analogies and avoid jargon. Focus on the 'why' and 'how' rather than the technical details. What is the big idea here?",
  },
  {
    id: 'future-work',
    label: 'Future Work',
    icon: Lightbulb,
    description: 'Explore applications and next steps',
    content:
      'Based on the results and conclusions, what are the potential real-world applications of this research? Also, suggest three specific directions for future work that could build upon these findings.',
  },
  {
    id: 'initial-screen',
    label: 'The Initial Screen (Comprehension)',
    icon: Eye,
    description: 'Core identity questions for Title, Abstract, Introduction, and Conclusion',
    content:
      'In one sentence, what is the core problem or phenomenon the authors are investigating?\nWhat is the main argument or hypothesis they are putting forward?\nWhat is the ultimate conclusion or main takeaway the authors want the reader to believe?',
  },
  {
    id: 'deep-dive',
    label: 'The Deep Dive (Methodology & Critique)',
    icon: Microscope,
    description: 'Evaluation questions for Methods, Results, and Figures',
    content:
      'How exactly did they gather their data or test their claims (e.g., qualitative interviews, randomized controlled trial, historical analysis)?\nAre there obvious flaws, biases, or limitations in their design? (e.g., Is the sample size too small? Is the dataset outdated? Did they ignore a major variable?)\nDo the charts, data, and evidence actually support the claims made in the conclusion, or are the authors overstating their findings?',
  },
  {
    id: 'landscape',
    label: 'The Landscape (Contextualizing within the Field)',
    icon: Global,
    description: 'Contextualization questions for Literature Review and Discussion sections',
    content:
      'Who are the authors building upon, and who are they arguing against?\nDoes this paper agree with, contradict, or completely pivot away from the standard consensus in the field?\nWhat do the authors explicitly admit they missed, could not prove, or left out of scope?',
  },
  {
    id: 'synthesis',
    label: 'The Synthesis (Building Your Knowledge Base)',
    icon: Notepad,
    description: 'Knowledge-building questions to retain the paper long-term',
    content:
      'What are the key terms, frameworks, or theories defined in this paper that I need to add to my foundational knowledge?\nWhat are the big open questions or "future work" identified in this paper?\nIf I had to summarize this paper\'s overall contribution to the field in just three bullet points, what would they be?',
  },
];
