import Hooks from "./hooks"
import GrowCoral from "./grow_coral"

const allHooks = { ...Hooks, GrowCoral };

document.addEventListener("DOMContentLoaded", () => {
  // Find all elements with phx-hook
  document.querySelectorAll("[phx-hook]").forEach(el => {
    const hookName = el.getAttribute("phx-hook");
    const hook = allHooks[hookName];
    
    if (hook) {
      // Create a mock LiveView context for the hook
      const context = {
        el: el,
        pushEvent: (event, payload) => {
          console.log(`Mock pushEvent: ${event}`, payload);
        },
        pushEventTo: (selector, event, payload) => {
          console.log(`Mock pushEventTo: ${selector} -> ${event}`, payload);
        },
        handleEvent: (event, callback) => {
          // Listen for custom DOM events instead
          el.addEventListener(`phx:${event}`, (e) => callback(e.detail));
        },
        upload: () => console.log("Mock upload"),
        uploadTo: () => console.log("Mock uploadTo")
      };

      // Bind the context to the hook methods
      const boundHook = Object.create(hook);
      Object.assign(boundHook, context);
      
      // Call mounted
      if (typeof boundHook.mounted === "function") {
        boundHook.mounted();
      }
      
      // Store the instance on the element for future reference
      el._phxHook = boundHook;
    }
  });
});
