
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Category } from "./types";

// Safety check for API key
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is missing. AI features will be disabled.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const getAIInsights = async (transactions: Transaction[]) => {
  if (transactions.length === 0) return "Add some transactions to see AI insights!";
  
  const ai = getAiClient();
  if (!ai) return "AI insights are unavailable (No API Key)|Check documentation|Manual tracking enabled";

  const dataString = transactions.map(t => `${t.date}: ${t.amount} in ${t.category} (${t.note})`).join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze these transactions and provide 3 extremely concise, actionable financial "pro-tips" for an iOS app. 
      Format the response as a simple list separated by pipe characters (|). 
      Example: Reduce dining out|Check for duplicate subs|Set a transport goal.
      Transactions: \n${dataString}`,
      config: {
        systemInstruction: "You are a professional financial advisor. Your tips must be under 10 words each. Focus on spending reduction and savings. No conversational filler.",
      }
    });
    return response.text || "Track more to see patterns|Keep saving|Stay consistent";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Insights temporarily unavailable|Continue tracking|AI is resting";
  }
};

export const categorizeFromText = async (text: string): Promise<{amount: number, category: Category, note: string}> => {
  const ai = getAiClient();
  if (!ai) {
    // Fallback logic if AI is unavailable
    const amountMatch = text.match(/\d+/);
    return { 
      amount: amountMatch ? parseFloat(amountMatch[0]) : 0, 
      category: Category.OTHER, 
      note: text 
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extract spending details from this text: "${text}". If amount is not clear, use 0. Categories: Food & Drink, Transport, Shopping, Entertainment, Housing, Utilities, Income, Other.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            note: { type: Type.STRING }
          },
          required: ["amount", "category", "note"]
        }
      }
    });
    const result = JSON.parse(response.text || '{}');
    return {
      amount: result.amount || 0,
      category: (Object.values(Category).includes(result.category as Category) ? result.category : Category.OTHER) as Category,
      note: result.note || text
    };
  } catch (e) {
    console.error("Gemini Categorization Error:", e);
    return { amount: 0, category: Category.OTHER, note: text };
  }
};
