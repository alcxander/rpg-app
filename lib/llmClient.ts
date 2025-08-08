import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function generateContent(prompt: string, system?: string) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not set. Please configure it in your environment variables.');
  }

  try {
    const { text } = await generateText({
      model: openai('gpt-4o'), // Using gpt-4o as a powerful general model
      prompt,
      system,
    });
    return text;
  } catch (error: any) {
    console.error('Error generating content with LLM:', error);
    // Provide more specific error messages based on common API errors
    if (error.message?.includes('401')) {
      throw new Error('Failed to generate content: Invalid OpenAI API key. Please check your OPENAI_API_KEY.');
    } else if (error.message?.includes('429')) {
      throw new Error('Failed to generate content: OpenAI rate limit exceeded. Please try again later.');
    } else if (error.message?.includes('500')) {
      throw new Error('Failed to generate content: OpenAI server error. Please try again.');
    }
    throw new Error(`Failed to generate content: ${error.message || 'An unknown error occurred.'}`);
  }
}
