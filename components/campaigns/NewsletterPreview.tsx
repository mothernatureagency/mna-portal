import React from 'react';
export default function NewsletterPreview({html}:{html:string}) {
  const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">';
  return <iframe title="Newsletter design preview" sandbox="" srcDoc={policy+html} className="w-full h-[540px] rounded-xl bg-white"/>;
}
