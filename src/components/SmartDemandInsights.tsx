import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, TrendingUp, ChevronDown, ChevronUp, Repeat, ShoppingBag, Tag, Ruler, Users, Layers } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface EntryForAnalysis {
  id: string;
  notes: string;
  shop_id: string;
  category_id: string;
  size_id: string;
  customer_type_id: string | null;
  created_at: string;
  shops?: { name: string } | null;
  categories?: { name: string } | null;
  sizes?: { size: string } | null;
  customer_types?: { name: string } | null;
  customFieldValues?: Record<string, string>;
}

interface DemandPattern {
  key: string;
  count: number;
  shop: string;
  category: string;
  size: string;
  customerType: string;
  notesSample: string;
  customFields?: Record<string, string>;
  firstSeen: string;
  lastSeen: string;
  frequency: string; // e.g. "3x in 7 days"
}

interface DimensionHotspot {
  dimension: string;
  value: string;
  count: number;
  percentage: number;
  icon: typeof ShoppingBag;
}

interface SmartDemandInsightsProps {
  entries: EntryForAnalysis[];
  customFields?: Array<{ id: string; name: string }>;
}

// Normalize notes for comparison - extract key demand words
const normalizeNotes = (notes: string): string => {
  if (!notes) return '';
  return notes
    .toLowerCase()
    .replace(/[^a-z0-9\u0B80-\u0BFF\s]/g, '') // keep alphanumeric + Tamil chars
    .replace(/\s+/g, ' ')
    .trim();
};

// Simple similarity check - are two notes talking about the same thing?
const areNotesSimilar = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  const normA = normalizeNotes(a);
  const normB = normalizeNotes(b);
  
  if (normA === normB) return true;
  
  // Check if one contains the other (for short vs long descriptions)
  if (normA.length > 3 && normB.length > 3) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }
  
  // Word overlap similarity
  const wordsA = new Set(normA.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 2));
  
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  
  let overlap = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) overlap++; });
  
  const similarity = overlap / Math.min(wordsA.size, wordsB.size);
  return similarity >= 0.6; // 60% word overlap = similar
};

export const SmartDemandInsights = ({ entries, customFields = [] }: SmartDemandInsightsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const analysis = useMemo(() => {
    if (!entries || entries.length < 2) return null;

    // 1. Find exact combination patterns (same shop + category + size + customer type + similar notes)
    const patternGroups: Map<string, EntryForAnalysis[]> = new Map();
    
    entries.forEach(entry => {
      // Create a composite key from dimensions
      const baseKey = `${entry.shop_id}|${entry.category_id}|${entry.size_id}|${entry.customer_type_id || 'none'}`;
      
      // Check if this entry's notes match an existing group with same dimensions
      let matchedKey: string | null = null;
      
      for (const [existingKey, group] of patternGroups.entries()) {
        if (existingKey.startsWith(baseKey)) {
          // Same dimensions - check notes similarity
          if (areNotesSimilar(entry.notes, group[0].notes)) {
            matchedKey = existingKey;
            break;
          }
        }
      }
      
      if (matchedKey) {
        patternGroups.get(matchedKey)!.push(entry);
      } else {
        const uniqueKey = `${baseKey}|${normalizeNotes(entry.notes).substring(0, 30)}`;
        patternGroups.set(uniqueKey, [entry]);
      }
    });

    // Convert to DemandPatterns (only groups with 2+ entries)
    const patterns: DemandPattern[] = [];
    
    for (const [key, group] of patternGroups.entries()) {
      if (group.length < 2) continue;
      
      const sorted = group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const firstDate = new Date(sorted[0].created_at);
      const lastDate = new Date(sorted[sorted.length - 1].created_at);
      const daySpan = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Build custom field display
      const cfValues: Record<string, string> = {};
      if (customFields.length > 0 && sorted[0].customFieldValues) {
        customFields.forEach(cf => {
          const val = sorted[0].customFieldValues?.[cf.id];
          if (val) cfValues[cf.name] = val;
        });
      }

      patterns.push({
        key,
        count: group.length,
        shop: sorted[0].shops?.name || 'Unknown',
        category: sorted[0].categories?.name || 'Unknown',
        size: sorted[0].sizes?.size || 'Unknown',
        customerType: sorted[0].customer_types?.name || 'N/A',
        notesSample: sorted[0].notes?.substring(0, 80) || '',
        customFields: Object.keys(cfValues).length > 0 ? cfValues : undefined,
        firstSeen: firstDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        lastSeen: lastDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        frequency: `${group.length}x in ${daySpan} day${daySpan > 1 ? 's' : ''}`,
      });
    }
    
    patterns.sort((a, b) => b.count - a.count);

    // 2. Dimension hotspots - which single dimension has highest concentration
    const total = entries.length;
    const hotspots: DimensionHotspot[] = [];
    
    // By Shop
    const shopCounts: Record<string, number> = {};
    entries.forEach(e => { const n = e.shops?.name || 'Unknown'; shopCounts[n] = (shopCounts[n] || 0) + 1; });
    Object.entries(shopCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([value, count]) => {
      if (count >= 2) hotspots.push({ dimension: 'Shop', value, count, percentage: Math.round((count / total) * 100), icon: ShoppingBag });
    });

    // By Category
    const catCounts: Record<string, number> = {};
    entries.forEach(e => { const n = e.categories?.name || 'Unknown'; catCounts[n] = (catCounts[n] || 0) + 1; });
    Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([value, count]) => {
      if (count >= 2) hotspots.push({ dimension: 'Category', value, count, percentage: Math.round((count / total) * 100), icon: Tag });
    });

    // By Size
    const sizeCounts: Record<string, number> = {};
    entries.forEach(e => { const n = e.sizes?.size || 'Unknown'; sizeCounts[n] = (sizeCounts[n] || 0) + 1; });
    Object.entries(sizeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([value, count]) => {
      if (count >= 2) hotspots.push({ dimension: 'Size', value, count, percentage: Math.round((count / total) * 100), icon: Ruler });
    });

    // By Customer Type
    const ctCounts: Record<string, number> = {};
    entries.forEach(e => { const n = e.customer_types?.name || 'N/A'; ctCounts[n] = (ctCounts[n] || 0) + 1; });
    Object.entries(ctCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([value, count]) => {
      if (count >= 2 && value !== 'N/A') hotspots.push({ dimension: 'Customer Type', value, count, percentage: Math.round((count / total) * 100), icon: Users });
    });

    // By Custom Fields
    if (customFields.length > 0) {
      customFields.forEach(cf => {
        const cfCounts: Record<string, number> = {};
        entries.forEach(e => {
          const val = e.customFieldValues?.[cf.id];
          if (val) cfCounts[val] = (cfCounts[val] || 0) + 1;
        });
        Object.entries(cfCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([value, count]) => {
          if (count >= 2) hotspots.push({ dimension: cf.name, value, count, percentage: Math.round((count / total) * 100), icon: Layers });
        });
      });
    }

    // Sort hotspots by percentage descending
    hotspots.sort((a, b) => b.percentage - a.percentage);

    // 3. Notes keyword frequency (what customers are asking for most)
    const wordFreq: Record<string, number> = {};
    const stopWords = new Set(['the', 'and', 'for', 'was', 'not', 'but', 'has', 'had', 'are', 'with', 'this', 'that', 'from', 'they', 'been', 'have', 'its', 'will', 'can', 'all', 'one', 'two', 'out', 'also', 'customer', 'asked', 'wants', 'want', 'need', 'needed']);
    
    entries.forEach(e => {
      if (!e.notes) return;
      const words = normalizeNotes(e.notes).split(' ').filter(w => w.length > 2 && !stopWords.has(w));
      words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
    });
    
    const topKeywords = Object.entries(wordFreq)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    return {
      patterns: patterns.slice(0, showAll ? 20 : 5),
      totalPatterns: patterns.length,
      hotspots: hotspots.slice(0, 8),
      topKeywords,
      totalEntries: total,
    };
  }, [entries, customFields, showAll]);

  if (!analysis || (analysis.patterns.length === 0 && analysis.hotspots.length === 0)) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-primary/5 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-base sm:text-lg">Smart Demand Insights</CardTitle>
                {analysis.patterns.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {analysis.totalPatterns} pattern{analysis.totalPatterns !== 1 ? 's' : ''} found
                  </Badge>
                )}
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-5 pt-0">
            {/* Top Repeated Demand Patterns */}
            {analysis.patterns.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-orange-500" />
                  <h3 className="text-sm font-semibold">Repeated Demand Patterns</h3>
                </div>
                <div className="space-y-2">
                  {analysis.patterns.map((pattern, idx) => (
                    <div
                      key={pattern.key}
                      className="rounded-lg border bg-card p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="destructive" className="text-xs font-bold">
                            {pattern.count}x
                          </Badge>
                          <Badge variant="outline" className="text-xs">{pattern.shop}</Badge>
                          <Badge variant="secondary" className="text-xs">{pattern.category}</Badge>
                          <Badge variant="outline" className="text-xs">Size: {pattern.size}</Badge>
                          {pattern.customerType !== 'N/A' && (
                            <Badge variant="secondary" className="text-xs">{pattern.customerType}</Badge>
                          )}
                          {pattern.customFields && Object.entries(pattern.customFields).map(([name, val]) => (
                            <Badge key={name} variant="outline" className="text-xs">
                              {name}: {val}
                            </Badge>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {pattern.frequency}
                        </span>
                      </div>
                      {pattern.notesSample && (
                        <p className="text-xs text-muted-foreground line-clamp-2 tamil-content">
                          "{pattern.notesSample}"
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>First: {pattern.firstSeen}</span>
                        <span>•</span>
                        <span>Last: {pattern.lastSeen}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {analysis.totalPatterns > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAll(!showAll)}
                    className="w-full text-xs"
                  >
                    {showAll ? 'Show Less' : `Show All ${analysis.totalPatterns} Patterns`}
                  </Button>
                )}
              </div>
            )}

            {/* Dimension Hotspots */}
            {analysis.hotspots.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <h3 className="text-sm font-semibold">Top Demand Hotspots</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {analysis.hotspots.map((spot, idx) => {
                    const Icon = spot.icon;
                    return (
                      <div key={`${spot.dimension}-${spot.value}-${idx}`} className="rounded-lg border bg-card p-2.5 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs text-muted-foreground truncate">{spot.dimension}</span>
                        </div>
                        <p className="text-sm font-medium truncate" title={spot.value}>{spot.value}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary">{spot.count} entries</span>
                          <Badge variant="secondary" className="text-xs">{spot.percentage}%</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Keywords from Notes */}
            {analysis.topKeywords.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold">Most Mentioned Keywords</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.topKeywords.map(kw => (
                    <Badge
                      key={kw.word}
                      variant="outline"
                      className="text-xs"
                    >
                      {kw.word} <span className="ml-1 text-primary font-bold">×{kw.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
