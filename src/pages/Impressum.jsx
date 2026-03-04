import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Impressum() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">Legal Notice</h1>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Information according to § 5 TMG</h2>
            <p className="text-slate-600">
              ORBYLOX<br />
              [Your address]<br />
              [Postal code and city]<br />
              Germany
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Contact</h2>
            <p className="text-slate-600">
              Email: contact@orbylox.com<br />
              Phone: [Your phone number]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Responsible for content according to § 55 Abs. 2 RStV</h2>
            <p className="text-slate-600">
              [Your name]<br />
              [Your address]<br />
              [Postal code and city]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">EU dispute resolution</h2>
            <p className="text-slate-600">
              The European Commission provides a platform for online dispute resolution (ODR):{' '}
              <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                https://ec.europa.eu/consumers/odr/
              </a>
              <br />
              Our email address can be found above in the legal notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Consumer dispute resolution</h2>
            <p className="text-slate-600">
              We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Liability for content</h2>
            <p className="text-slate-600">
              As a service provider we are responsible for our own content on these pages in accordance with general laws pursuant to § 7 para. 1 TMG. According to §§ 8 to 10 TMG we are not obliged to monitor transmitted or stored third-party information or to investigate circumstances that indicate illegal activity.
            </p>
            <p className="text-slate-600 mt-2">
              Obligations to remove or block the use of information under general law remain unaffected. However, liability in this regard is only possible from the time of knowledge of a specific legal violation. Upon becoming aware of corresponding legal violations we will remove this content immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Liability for links</h2>
            <p className="text-slate-600">
              Our site contains links to external third-party websites over whose content we have no influence. Therefore we cannot assume any liability for this external content. The respective provider or operator of the linked pages is always responsible for the content of the linked pages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Copyright</h2>
            <p className="text-slate-600">
              The content and works created by the site operators on these pages are subject to copyright law. Reproduction, editing, distribution and any kind of use outside the limits of copyright law require the written consent of the respective author or creator.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 text-center text-sm text-slate-400">
          © 2024 ORBYLOX. All rights reserved.
        </div>
      </div>
    </div>
  );
}
