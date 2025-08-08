import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapToken } from '@/lib/types';
import { cn } from '@/lib/utils'; // Import cn

interface StatBlockProps {
  name: string;
  stats: Record<string, any>;
  type?: 'monster' | 'pc';
}

export function StatBlock({ name, stats, type = 'monster' }: StatBlockProps) {
  console.log('StatBlock: Component rendered with name:', name, 'stats:', stats, 'type:', type);
  return (
    <Card className={cn("bg-gray-800 text-white border-gray-700 shadow-lg", type === 'monster' ? 'border-red-500' : 'border-blue-500')}> {/* Example usage of cn */}
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold text-purple-400">{name}</CardTitle>
        <p className="text-sm text-gray-400 capitalize">{type}</p>
      </CardHeader>
      <CardContent className="text-sm">
        {Object.entries(stats).map(([key, value]) => {
          return (
            <div key={key} className="flex justify-between py-1 border-b border-gray-700 last:border-b-0">
              <span className="font-semibold text-gray-300">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span>
              <span className="text-gray-200">
                {(() => {
                  try {
                    if (value === null || value === undefined) {
                      return 'N/A';
                    }
                    if (typeof value === 'object') {
                      // Attempt to stringify, catch errors
                      return JSON.stringify(value);
                    }
                    // For primitive types, directly convert to string
                    return String(value);
                  } catch (e) {
                    console.error(`StatBlock: Error rendering stat value for key "${key}" with value:`, value, e);
                    return '[Error Rendering Stat]';
                  }
                })()}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
