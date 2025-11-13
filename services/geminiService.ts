import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is not set in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

export interface AISuggestion {
  improvedText: string;
  extractedData: {
    date: string | null;
    time: string | null;
    location: string | null;
    categories: string[];
  };
}

export const processNaturalLanguageNote = async (
  noteText: string,
  availableCategories: string[]
): Promise<AISuggestion | null> => {
  if (!noteText.trim()) {
    return null;
  }

  const prompt = `
    Analiza el siguiente texto de una nota de un usuario. Tu tarea tiene dos partes:
    1.  **Reescribir el texto principal de la nota** para que sea más claro, conciso y profesional. Corrige errores gramaticales y de tipeo. Una vez que extraigas la fecha, hora y lugar, **elimínalos del texto reescrito** para evitar redundancia. El texto reescrito debe ser solo el núcleo de la tarea (p.ej., 'Reunión con la arquitecta').
    2.  **Extraer datos estructurados** del texto. Identifica una fecha (en formato AAAA-MM-DD), una hora (en formato HH:MM de 24 horas), una ubicación si se menciona, y sugiere hasta 3 categorías relevantes de la lista proporcionada.

    Si un campo de datos no se menciona, su valor debe ser 'null'.
    Hoy es ${new Date().toISOString().split('T')[0]}.

    Texto del usuario:
    "${noteText}"

    Categorías disponibles:
    [${availableCategories.map(c => `"${c}"`).join(', ')}]

    Responde únicamente con un objeto JSON que siga el schema especificado.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            improvedText: { type: Type.STRING, description: 'El texto de la nota, reescrito para ser más claro y profesional, excluyendo fecha, hora y lugar ya extraídos.' },
            extractedData: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING, nullable: true },
                time: { type: Type.STRING, nullable: true },
                location: { type: Type.STRING, nullable: true },
                categories: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
               required: ['date', 'time', 'location', 'categories']
            }
          },
          required: ['improvedText', 'extractedData']
        },
      }
    });

    const jsonString = response.text.trim();
    const parsed = JSON.parse(jsonString);

    // Validar y limpiar la respuesta
    const suggestion: AISuggestion = {
      improvedText: parsed.improvedText || noteText,
      extractedData: {
        date: parsed.extractedData.date || null,
        time: parsed.extractedData.time || null,
        location: parsed.extractedData.location || null,
        categories: Array.isArray(parsed.extractedData.categories)
          ? parsed.extractedData.categories.filter((cat: any) => typeof cat === 'string' && availableCategories.includes(cat))
          : []
      }
    };
    return suggestion;

  } catch (error) {
    console.error("Error processing note with Gemini:", error);
    // Fallback en caso de error: devuelve el texto original sin datos extraídos.
    return {
      improvedText: noteText,
      extractedData: { date: null, time: null, location: null, categories: [] }
    };
  }
};

export const improveNoteText = async (noteText: string): Promise<string | null> => {
    if (!noteText.trim()) return null;
    const prompt = `Reescribe el siguiente texto de una nota para que sea más claro, conciso y profesional. Corrige cualquier error gramatical o de tipeo. Responde únicamente con el texto mejorado. Texto original: "${noteText}"`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error improving text with Gemini:", error);
        return null;
    }
};

export const generateNoteDescription = async (noteText: string): Promise<string | null> => {
    if (!noteText.trim()) return null;
    const prompt = `Genera una descripción muy breve y concisa (una frase) para la siguiente nota. Esta descripción debe capturar la esencia de la tarea. Responde únicamente con la descripción. Texto de la nota: "${noteText}"`;
    try {
        const response = await ai.models.generateContent({
            model: 'gem-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error generating description with Gemini:", error);
        return null;
    }
};

export const improveProjectDescription = async (description: string): Promise<string | null> => {
    if (!description.trim()) return null;
    const prompt = `Reescribe la siguiente descripción de un proyecto para que sea más clara, inspiradora y esté bien estructurada. Enfócate en la claridad de los objetivos y el alcance. Responde únicamente con la descripción mejorada. Descripción original: "${description}"`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error improving project description with Gemini:", error);
        return null;
    }
};

export const suggestCategoriesForProject = async (projectDescription: string): Promise<string[] | null> => {
    if (!projectDescription.trim()) return null;
    const prompt = `Analiza la siguiente descripción de un proyecto y sugiere una lista de 5 a 7 categorías de tareas relevantes y accionables. Responde únicamente con un objeto JSON que contenga una clave "categories" con un array de strings. Descripción del proyecto: "${projectDescription}"`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        categories: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ['categories']
                }
            }
        });
        const jsonString = response.text.trim();
        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed.categories) ? parsed.categories : [];
    } catch (error) {
        console.error("Error suggesting categories with Gemini:", error);
        return null;
    }
};
