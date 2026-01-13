
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Category } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAIInsights = async (transactions: Transaction[]) => {
  if (transactions.length === 0) return "Welcome to iBudget Pro|Add expenses to start|AI insights will appear here";
  
  const recentData = transactions.slice(0, 30).map(t => ({
    amt: t.amount,
    cat: t.category,
    note: t.note,
    type: t.type,
    date: t.date
  }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a world-class financial advisor. Analyze these transactions: ${JSON.stringify(recentData)}. 
      Provide 3 ultra-short, highly specific financial tips or observations. 
      Separate them ONLY with the '|' character. 
      Keep each under 12 words. Focus on spending patterns or potential savings.`,
    });
    
    return response.text || "Track more to see patterns|Keep saving|Stay consistent";
  } catch (error) {
    console.error("AI Insights Error:", error);
    return "Insights temporarily unavailable|Using local processing|Stay consistent";
  }
};

export const categorizeFromText = async (text: string): Promise<{amount: number, category: Category, note: string}> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract info from: "${text}". Categories: ${Object.values(Category).join(", ")}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: "The numeric cost found in the text" },
            category: { type: Type.STRING, description: "The best fitting category from the provided list" },
            note: { type: Type.STRING, description: "A clean, capitalized name for the merchant/item" }
          },
          required: ["amount", "category", "note"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      amount: result.amount || 0,
      category: (Object.values(Category).includes(result.category as Category) ? result.category : Category.OTHER) as Category,
      note: result.note || text
    };
  } catch (e) {
    console.error("AI Categorization Error:", e);
    // Simple local fallback regex for offline/error use
    const amountMatch = text.match(/(\d+(\.\d+)?)/);
    return { 
      amount: amountMatch ? parseFloat(amountMatch[0]) : 0, 
      category: Category.OTHER, 
      note: text 
    };
  }
};
