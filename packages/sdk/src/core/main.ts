// src/core/main.ts
// (từ main_entry.js)

import { getUserIdentityManager } from './UserIdentityManager';
import { getAIItemDetector } from './AIItemDetector';
import { ClickPlugin } from '../plugins/ClickPlugin';
import { PageViewPlugin } from '../plugins/PageViewPlugin';
import { TrackerContext } from './TrackerContext';
import { setupSPARouterWrapper } from './utils';

function initializeRecsysTracker() {
  console.log("--- Recsys Tracker SDK Initializing (AI Mode) ---");
  
  setupSPARouterWrapper();

  const identityManager = getUserIdentityManager();
  
  const aiDetector = getAIItemDetector(); 
  aiDetector.init();

  const trackerContext = new TrackerContext();
  
  identityManager.setTrackerContext(trackerContext);

  identityManager.initialize();

  setTimeout(() => {
    
    const clickPlugin = new ClickPlugin();
    const pageViewPlugin = new PageViewPlugin();

    clickPlugin.init(trackerContext);
    pageViewPlugin.init(trackerContext);

    clickPlugin.start();
    pageViewPlugin.start();

    console.log("--- Recsys Tracker SDK Ready. AI item detection active ---");
  }, 500);

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRecsysTracker);
} else {
  initializeRecsysTracker();
}