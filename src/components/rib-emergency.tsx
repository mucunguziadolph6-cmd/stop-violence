import { Phone, ExternalLink, Siren } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RIB_CONTACT } from '@/lib/emergency-contacts';

export function RibEmergency() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" className="w-full">
          <Siren aria-hidden="true" /> RIB emergency
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">RIB emergency assistance</DialogTitle>
          <DialogDescription>Rwanda Investigation Bureau</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-foreground">For an emergency or crime report in Rwanda, call RIB’s toll-free number {RIB_CONTACT.emergencyNumber}.</p>
        <div className="flex flex-col gap-3">
          <Button asChild variant="destructive" size="lg">
            <a href={RIB_CONTACT.callUrl}><Phone aria-hidden="true" /> Call RIB — {RIB_CONTACT.emergencyNumber}</a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={RIB_CONTACT.websiteUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><ExternalLink aria-hidden="true" /> Official RIB website</a>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">This website is not monitored by RIB. Saving a report here does not send it to RIB. If you are in immediate danger, do not wait for a reply here.</p>
        <p className="text-xs text-muted-foreground">Calls require a phone connection; the RIB website requires internet access.</p>
      </DialogContent>
    </Dialog>
  );
}