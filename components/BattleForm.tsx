'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BattleFormProps {
isOpen: boolean;
onClose: () => void;
onGenerate: (data: {
  partyLevel: number;
  partySize: number;
  challengeRating: string;
  locationTheme: string;
  additionalNotes?: string;
}) => Promise<void>;
}

export function BattleForm({ isOpen, onClose, onGenerate }: BattleFormProps) {
const [partyLevel, setPartyLevel] = useState(3);
const [partySize, setPartySize] = useState(4);
const [challengeRating, setChallengeRating] = useState('Medium');
const [locationTheme, setLocationTheme] = useState('Forest');
const [additionalNotes, setAdditionalNotes] = useState('');
const [isLoading, setIsLoading] = useState(false);
const { toast } = useToast();

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  try {
    await onGenerate({
      partyLevel,
      partySize,
      challengeRating,
      locationTheme,
      additionalNotes: additionalNotes || undefined,
    });
    toast({
      title: 'Battle Generated!',
      description: 'The new battle scenario has been loaded onto the map.',
      className: 'bg-green-600 text-white',
    });
    onClose();
  } catch (error: any) {
    console.error('Failed to generate battle:', error);
    toast({
      title: 'Generation Failed',
      description: error.message || 'Could not generate battle. Please try again.',
      variant: 'destructive',
    });
  } finally {
    setIsLoading(false);
  }
};

return (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="sm:max-w-[500px] bg-gray-800 text-white border-gray-700">
      <DialogHeader>
        <DialogTitle className="text-2xl text-purple-400">Generate Battle Scenario</DialogTitle>
        <DialogDescription className="text-gray-400">
          Fill in the details to create a new battle encounter.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="partyLevel" className="text-right text-gray-300">
            Party Level
          </Label>
          <Input
            id="partyLevel"
            type="number"
            value={partyLevel}
            onChange={(e) => setPartyLevel(parseInt(e.target.value))}
            min="1"
            max="20"
            className="col-span-3 bg-gray-700 border-gray-600 text-white"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="partySize" className="text-right text-gray-300">
            Party Size
          </Label>
          <Input
            id="partySize"
            type="number"
            value={partySize}
            onChange={(e) => setPartySize(parseInt(e.target.value))}
            min="1"
            max="10"
            className="col-span-3 bg-gray-700 border-gray-600 text-white"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="challengeRating" className="text-right text-gray-300">
            Challenge Rating
          </Label>
          <Select value={challengeRating} onValueChange={setChallengeRating}>
            <SelectTrigger className="col-span-3 bg-gray-700 border-gray-600 text-white">
              <SelectValue placeholder="Select a rating" />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600 text-white">
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
              <SelectItem value="Deadly">Deadly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="locationTheme" className="text-right text-gray-300">
            Location Theme
          </Label>
          <Input
            id="locationTheme"
            value={locationTheme}
            onChange={(e) => setLocationTheme(e.target.value)}
            placeholder="e.g., Forest, Dungeon, City Market"
            className="col-span-3 bg-gray-700 border-gray-600 text-white"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="additionalNotes" className="text-right text-gray-300">
            Notes
          </Label>
          <Textarea
            id="additionalNotes"
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Any specific monsters, objectives, or environmental hazards?"
            className="col-span-3 bg-gray-700 border-gray-600 text-white"
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 text-white">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Battle'
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
);
}
