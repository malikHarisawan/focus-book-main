// Helper functions for timeline functionality

// Format date to YYYY-MM-DD for consistency with data structure
export function getFormattedDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format duration in milliseconds to human-readable format
export function formatDuration(durationMs) {
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Extract timeline data from JSON
export function extractTimelineData(jsonData, date) {
  // Use a Map to group apps by name or domain identity
  const appMap = new Map();
  
  // Process the hourly data from the JSON structure
  if (jsonData && jsonData[date]) {
    // First, gather all apps and their details
    const hourKeys = Object.keys(jsonData[date]).filter(key => key !== "apps");
    
    // Loop through each hour in the data
    hourKeys.forEach(hourKey => {
      // Convert hour key like "10:00" to a numeric hour value (10.0)
      const hourValue = parseInt(hourKey.split(':')[0], 10);
      
      // Process each app active during this hour
      const hourData = jsonData[date][hourKey];
      for (const [appName, appData] of Object.entries(hourData)) {
        if (!appName) continue;
        
        // Create a unique identifier for the app
        const appIdentifier = appData.domain || appData.description || appName;
        
        // If this app hasn't been added yet, create a new entry
        if (!appMap.has(appIdentifier)) {
          appMap.set(appIdentifier, {
            name: appIdentifier,
            icon: getAppIcon(appName, appData.category || "Miscellaneous"),
            category: appData.category || "Miscellaneous",
            segments: []
          });
        }
        
        // Add the hour-based segment to the app entry
        const appEntry = appMap.get(appIdentifier);
        // Use the app's actual time value if available, otherwise default to 1 hour
        const durationHours = (appData.time && appData.time > 0) 
          ? appData.time / (1000 * 60 * 60) // Convert milliseconds to hours
          : 1.0; 
        const color = getCategoryTimelineColor(appData.category || "Miscellaneous");
        
        // Check if there's already a segment for this hour
        const existingSegmentIndex = appEntry.segments.findIndex(seg => 
          Math.floor(seg.start) === hourValue
        );
        
        if (existingSegmentIndex >= 0) {
          // Update existing segment instead of adding a new one
          appEntry.segments[existingSegmentIndex].duration += durationHours;
        } else {
          // Add a new segment
          appEntry.segments.push({
            start: hourValue,
            duration: durationHours,
            color: color
          });
        }
      }
    });
  }
  
  // For apps with multiple adjacent segments, merge them
  for (const [, appData] of appMap.entries()) {
    if (appData.segments.length > 1) {
      appData.segments.sort((a, b) => a.start - b.start);
      
      // Merge adjacent segments
      for (let i = appData.segments.length - 1; i > 0; i--) {
        const current = appData.segments[i];
        const previous = appData.segments[i-1];
        
        if (Math.abs((previous.start + previous.duration) - current.start) < 0.1) {
          previous.duration += current.duration;
          appData.segments.splice(i, 1);
          i--; // Adjust index after splice
        }
      }
    }
  }
  
  const result = Array.from(appMap.values());
  console.log("timeline array ==>", result);
  return result;
}

// Helper function to get color based on category
export function getCategoryTimelineColor(category) {
  switch(category) {
    case "Code":
      return "green";
    case "Entertainment":
      return "red";
    case "Communication":
      return "blue";
    case "Browsing":
      return "amber";
    case "Utilities":
      return "purple";
    default:
      return "gray";
  }
}

// Helper function to get icon for app
export function getAppIcon(appName, category) {
  if (!appName) return "📊";
  if (appName.includes("Code") || appName.includes("Visual Studio")) return "💻";
  if (appName.includes("Chrome") || appName.includes("Brave") || appName.includes("Edge")) return "🌐";
  if (appName.includes("Teams") || appName.includes("Slack")) return "💬";
  if (appName.includes("Spotify")) return "🎵";
  if (appName.includes("YouTube")) return "📺";
  if (appName.includes("Twitter") || appName.includes("X")) return "🐦";
  if (appName.includes("LinkedIn")) return "👔";
  
  // Default icons based on category
  switch(category) {
    case "Code":
      return "💻";
    case "Entertainment":
      return "🎮";
    case "Communication":
      return "📱";
    case "Browsing":
      return "🌐";
    case "Utilities":
      return "🛠️";
    default:
      return "📊";
  }
}
