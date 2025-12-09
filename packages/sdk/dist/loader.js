(function(d,w){
  // Create stub to queue calls before SDK loads
  w.RecSysTracker = w.RecSysTracker || function(){
    (w.RecSysTracker.q = w.RecSysTracker.q || []).push(arguments);
  };
  
  // Store domain key from global variable
  w.RecSysTracker.domainKey = w.__RECSYS_DOMAIN_KEY__;

  // Load the IIFE bundle
  var s = d.createElement("script");
  s.async = true;
  s.src = (d.currentScript && d.currentScript.src) 
    ? d.currentScript.src.replace('loader.js', 'recsys-tracker.iife.js')
    : "recsys-tracker.iife.js";
  d.head.appendChild(s);
})(document, window);

// Example loader script
// <script>window.__RECSYS_DOMAIN_KEY__ = "your-domain-key";</script>
// <script src="https://cdn.jsdelivr.net/gh/Xaoimiimii/recsys-tracker-module/packages/sdk/dist/loader.js"></script>
