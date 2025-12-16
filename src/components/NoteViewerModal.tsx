import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye } from 'lucide-react';

interface NoteViewerModalProps {
    notes: string;
    triggerClassName?: string;
}

export const NoteViewerModal = ({ notes, triggerClassName }: NoteViewerModalProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile screen
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Truncate display text
    const truncatedText = notes.length > 20 ? notes.substring(0, 20) + '...' : notes;
    const showViewButton = notes.length > 20;

    const modalContent = (
        <ScrollArea className="max-h-[60vh] md:max-h-[70vh]">
            <div className="pr-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {notes}
                </p>
            </div>
        </ScrollArea>
    );

    // Desktop: centered Dialog, Mobile: bottom Sheet
    if (isMobile) {
        return (
            <div className="flex items-center gap-1 min-w-0">
                <span className="truncate flex-1 text-xs md:text-sm" title={notes}>
                    {truncatedText}
                </span>
                {showViewButton && (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsOpen(true)}
                            className={`h-6 px-2 text-xs gap-1 shrink-0 ${triggerClassName || ''}`}
                        >
                            <Eye className="h-3 w-3" />
                            View
                        </Button>
                        <Sheet open={isOpen} onOpenChange={setIsOpen}>
                            <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
                                <SheetHeader className="pb-4">
                                    <SheetTitle>Full Notes</SheetTitle>
                                    <SheetDescription className="sr-only">
                                        View the complete note content
                                    </SheetDescription>
                                </SheetHeader>
                                {modalContent}
                            </SheetContent>
                        </Sheet>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1 min-w-0">
            <span className="truncate flex-1 text-xs md:text-sm" title={notes}>
                {truncatedText}
            </span>
            {showViewButton && (
                <>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsOpen(true)}
                        className={`h-6 px-2 text-xs gap-1 shrink-0 ${triggerClassName || ''}`}
                    >
                        <Eye className="h-3 w-3" />
                        View
                    </Button>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogContent className="max-w-lg max-h-[80vh]">
                            <DialogHeader>
                                <DialogTitle>Full Notes</DialogTitle>
                                <DialogDescription className="sr-only">
                                    View the complete note content
                                </DialogDescription>
                            </DialogHeader>
                            {modalContent}
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </div>
    );
};
