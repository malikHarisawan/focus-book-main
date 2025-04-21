export const formatTime = (milliseconds) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  export const processUsageChartData = (jsonData, date, viewType = 'day') => {
  
    if (viewType === 'day') {
      if (!jsonData || !jsonData[date]) {
        return [];
      }
    
      console.log("data in the utility function ", jsonData)
        const hourlyData = [];
        
        for (let i = 9; i <= 21; i++) { 
          hourlyData.push({
            name: i === 12 ? '12PM' : 
                  i < 12 ? `${i}AM` : `${i-12}PM`,
            Code: 0,
            Browsing: 0,
            Communication: 0,
            Utilities: 0,
            Entertainment: 0,
            Miscellaneous: 0
          });
        }
      
        for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
          if (hourKey === 'apps') continue;
      
          const hour = parseInt(hourKey.split(':')[0]);
          if (isNaN(hour) || hour < 0 || hour >= 24) continue;
      
          const index = hour - 9;
          if (index < 0 || index >= hourlyData.length) continue;
      
          for (const app of Object.values(hourData)) {
            if (app.category) {
              if (hourlyData[index][app.category] !== undefined) {
                hourlyData[index][app.category] += app.time / 1000;
              } else {
                hourlyData[index][app.category] = app.time / 1000;
              }
            }
          }
        }
      
        return hourlyData;
      }
    
    else {
      // if (!jsonData || !jsonData[date]) {
      //   return [];
      // }

      const weekData = [];
      const dateObj = new Date(date);
      const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(dateObj);
        currentDate.setDate(dateObj.getDate() - dateObj.getDay() + i);
        
        const formattedDate = currentDate.toISOString().split('T')[0];
        
        const dayData = {
          name: dayNames[i],
          Code: 0,
          Browsing: 0,
          Communication: 0,
          Utilities: 0,
          Entertainment: 0,
          Miscellaneous: 0
        };
        
        if (jsonData[formattedDate] && jsonData[formattedDate].apps) {
          for (const app of Object.values(jsonData[formattedDate].apps)) {
            if (app.category) {
           
              if (dayData[app.category] !== undefined) {
                dayData[app.category] += app.time / 1000;
              } else {
                dayData[app.category] = app.time / 1000;
              }
            }
          }
        }
        
        weekData.push(dayData);
      }
      console.log("week", weekData)
      return weekData;
    }
  };

  export const processProductiveChartData = (jsonData, date, viewType = 'day') => {
  
  
    if (viewType === 'day') {
      if (!jsonData || !jsonData[date]) {
        return [];
      }
      const hourlyData = [];
  
      for (let i = 9; i <= 21; i++) {
        hourlyData.push({
          day: i === 12 ? '12PM' : i < 12 ? `${i}AM` : `${i - 12}PM`,
          productive: 0,
          unproductive: 0,
        });
      }
  
      for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
        if (hourKey === 'apps') continue;
  
        const hour = parseInt(hourKey.split(':')[0]);
        if (isNaN(hour) || hour < 0 || hour > 23) continue;
  
        const index = hour - 9;
        if (index < 0 || index >= hourlyData.length) continue;
  
        for (const app of Object.values(hourData)) {
          if (!app.category || !app.time) continue;
  
          const seconds = app.time / 1000;
          const isProductive = ['Code',"Browsing"].includes(app.category);
          
          if (isProductive) {
            hourlyData[index].productive += seconds;
          } else {
            hourlyData[index].unproductive += seconds;
          }
        }
      }
  
      return hourlyData;
    } 
    
    else {
      const weekData = [];
      const dateObj = new Date(date);
      const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(dateObj);
        currentDate.setDate(dateObj.getDate() - dateObj.getDay() + i);
        const formattedDate = currentDate.toISOString().split('T')[0];
  
        const dayData = {
          day: dayNames[i],
          productive: 0,
          unproductive: 0,
        };
  
        if (jsonData[formattedDate] && jsonData[formattedDate].apps) {
          for (const app of Object.values(jsonData[formattedDate].apps)) {
            if (!app.category || !app.time) continue;
  
            const seconds = app.time / 1000;
            const isProductive = ['Code', 'Browsing'].includes(app.category);
  
            if (isProductive) {
              dayData.productive += seconds;
            } else {
              dayData.unproductive += seconds;
            }
          }
        }
  
        weekData.push(dayData);
      }
  
      return weekData;
    }
  };
  
  
  export const processMostUsedApps = (jsonData, date) => {
    if (!jsonData || !jsonData[date] || !jsonData[date].apps) {
      return [];
    }
  
    const appTimeMap = {};
  
    for (const [name, data] of Object.entries(jsonData[date].apps)) {
      const key = data.domain || name.description;
  
      if (appTimeMap[key]) {
        appTimeMap[key].time += data.time; 
      } else {
        appTimeMap[key] = {
          name,                   
          time: data.time,
          category: data.category,
          domain: data.domain,
          description:data.description
        };
      }
    }
  
    const apps = Object.values(appTimeMap);
  

    apps.sort((a, b) => b.time - a.time);
  
    const maxTime = apps[0]?.time || 1;
  
    return apps.slice(0, 10).map(app => ({
      name: app.domain
        ? app.domain
        : app.description,
      time: formatTime(app.time),
      usagePercent: app.time / maxTime,
      icon: app.name.charAt(0).toUpperCase(),
      category: app.category
    }));
  };
  
  
  export const getTotalScreenTime = (jsonData, date, processedChartData, view) => {
    let totalTime = 0;
  
    if (view === 'day') {
      if (!jsonData || !jsonData[date] || !jsonData[date].apps) {
        return "0h 0m";
      }
      for (const app of Object.values(jsonData[date].apps)) {
        totalTime += app.time;
      }
      return formatTime(totalTime);
    } else {
      for (const day of processedChartData) {
        for (const key in day) {
          if (key !== "name") {
            console.log(day[key])
            totalTime += day[key];
          }
        }
      }
      const average = formatTime((totalTime * 1000) / processedChartData.length);
      console.log("average", processedChartData.length);
      return average;
    }
  };
  
  export const getCategoryBreakdown = (jsonData, date) => {
    if (!jsonData || !jsonData[date] || !jsonData[date].apps) {
      return [];
    }
  
    const categories = {
      Code: { time: 0, color: "text-green-400" },
      Browsing: { time: 0, color: "text-purple-400" },
      Communication: { time: 0, color: "text-blue-500" },
      Utilities: { time: 0, color: "text-sky-400" },
      Entertainment: { time: 0, color: "text-rose-400" },
      Miscellaneous: { time: 0, color: "text-gray-500" },
    };
    
  
    for (const app of Object.values(jsonData[date].apps)) {
      if (app.category && categories[app.category]) {
        categories[app.category].time += app.time;
      } 
    }
  
    return Object.entries(categories)
      .filter(([_, data]) => data.time >  60000 )
      .sort((a,b)=> b[1].time - a[1].time)
      .map(([name, data]) => ({
        name: name,
        time: formatTime(data.time),
        color: data.color
      }));
  };