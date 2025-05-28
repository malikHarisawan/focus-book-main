import React, { createContext, useState, useContext } from 'react';

const DateContext = createContext();

export function DateProvider({ children }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  return (
    <DateContext.Provider value={{ selectedDate, handleDateChange }}>
      {children}
    </DateContext.Provider>
  );
}

export function useDate() {
  return useContext(DateContext);
}