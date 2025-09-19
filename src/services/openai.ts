import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';

export type MorningCheckin = {
  sleep: number;
  mood: number;
  energy: number;
  notes: string;
};

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY must be set in environment variables');
    this.client = new OpenAI({ apiKey });
  }

  parseMorningCheckin(message: string): MorningCheckin | null {
    try {
      const pattern = /Sleep\s+(\d+(?:\.\d+)?)h?\s*\|\s*Mood\s+(\d+)\s*\|\s*Energy\s+(\d+)\s*\|\s*Notes:\s*(.+)/i;
      const match = message.match(pattern);
      if (!match) return null;
      const sleep = parseFloat(match[1]);
      const mood = parseInt(match[2], 10);
      const energy = parseInt(match[3], 10);
      const notes = match[4].trim();
      return { sleep, mood, energy, notes };
    } catch (err) {
      console.error('Error parsing morning check-in:', err);
      return null;
    }
  }

  async parseMorningCheckinFlexible(message: string): Promise<MorningCheckin | null> {
    // First try strict format via regex
    const strict = this.parseMorningCheckin(message);
    if (strict) return strict;

    try {
      const systemPrompt = `You extract structured data from short, informal morning check-ins.

Return ONLY strict JSON (no markdown, no prose) with keys: "sleep" (number in hours, e.g., 6.5), "mood" (integer 1-10), "energy" (integer 1-10), and "notes" (string with remaining info). If any field is missing, infer conservatively from context or set reasonable defaults: if mood or energy not provided, return null for that field; if sleep is missing, return null. Keep notes concise.`;

      const userPrompt = `Parse this check-in: ${message}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 120,
        temperature: 0,
      });

      const raw = response.choices[0]?.message?.content?.trim() || '';
      if (!raw) return null;

      // Attempt to isolate JSON in case the model adds formatting
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : raw;

      const data = JSON.parse(jsonString) as Partial<MorningCheckin & { mood: number | null; energy: number | null; sleep: number | null }>;

      if (data == null) return null;

      const sleep = typeof data.sleep === 'number' ? data.sleep : NaN;
      const mood = typeof data.mood === 'number' ? Math.round(data.mood) : NaN;
      const energy = typeof data.energy === 'number' ? Math.round(data.energy) : NaN;
      const notes = (data.notes ?? '').toString().trim();

      // Require at least one of the numeric fields to be present along with notes to consider it valid
      const hasAnyNumeric = !Number.isNaN(sleep) || !Number.isNaN(mood) || !Number.isNaN(energy);
      if (!hasAnyNumeric && !notes) return null;

      return {
        sleep: Number.isNaN(sleep) ? 0 : sleep,
        mood: Number.isNaN(mood) ? 0 : mood,
        energy: Number.isNaN(energy) ? 0 : energy,
        notes,
      };
    } catch (err) {
      console.error('LLM parsing error for morning check-in:', err);
      return null;
    }
  }

  async generateDailyPlan(checkin: MorningCheckin, userName?: string): Promise<string> {
    try {
      const systemPrompt = `You are a supportive, direct life coach. Your role is to help users create actionable daily plans based on their morning check-ins.

Key principles:
- Be encouraging but realistic
- Provide specific, actionable advice
- Consider their sleep, mood, and energy levels
- Keep responses concise but comprehensive
- End with a motivational line

Format your response as a daily plan with:
1. 3 priorities (specific tasks)
2. 2 wellness activities (health/wellbeing focused)
3. 1 motivational line

Be direct and supportive in your tone.`;

      const userPrompt = `Based on this morning check-in, create a personalized daily plan:

Sleep: ${checkin.sleep} hours
Mood: ${checkin.mood}/10
Energy: ${checkin.energy}/10
Notes: ${checkin.notes}

${userName ? `User's name: ${userName}` : ''}

Please provide a daily plan with 3 priorities, 2 wellness activities, and 1 motivational line.`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });
      return response.choices[0]?.message?.content?.trim() || 'Unable to generate a plan right now.';
    } catch (err) {
      console.error('Error generating daily plan:', err);
      return "I'm having trouble generating your daily plan right now. Please try again later.";
    }
  }

  async generateGeneralResponse(message: string, userName?: string): Promise<string> {
    try {
      const systemPrompt = 'You are a supportive, direct life coach. Respond to user messages with helpful, encouraging advice. Keep responses concise and actionable. If the user has\'t provided a morning check-in, gently remind them about the format.';
      const userPrompt = `User message: ${message}

${userName ? `User's name: ${userName}` : ''}

Respond as their supportive coach. If this isn't a morning check-in, remind them about the format: "Sleep __h | Mood __ | Energy __ | Notes: __" `;

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });
      return response.choices[0]?.message?.content?.trim() || 'I\'m here to help! Please send me your morning check-in in this format: Sleep __h | Mood __ | Energy __ | Notes: __';
    } catch (err) {
      console.error('Error generating general response:', err);
      return "I'm here to help! Please send me your morning check-in in this format: Sleep __h | Mood __ | Energy __ | Notes: __";
    }
  }
}

export const openAIService = new OpenAIService();


