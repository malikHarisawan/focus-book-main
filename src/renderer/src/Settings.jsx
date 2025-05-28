import React, { useEffect, useState } from 'react';

const allCategories = ['Entertainment', 'Email', 'Idle', 'Social Media', 'Games', 'Shopping'];

export default function Settings() {
  const [selectedCategories, setSelectedCategories] = useState(window.activeWindow.getDistractedCat());
  const [newCategory, setNewCategory] = useState('');

  useEffect(()=>{
    addCategory()
  },[selectedCategories])

  const addCategory = () => {
    if (newCategory && !selectedCategories.includes(newCategory)) {
      setSelectedCategories([...selectedCategories, newCategory]);
    }
    saveData()
  };

  const saveData = ()=> window.activeWindow.send('saveDistApp',selectedCategories)
  const removeCategory = (cat) => {
    setSelectedCategories(selectedCategories.filter(c => c !== cat));
  };

  return (
    <div className="p-6 rounded-xl bg-gray-800 text-white max-w-2xl mx-auto mt-10 shadow-lg">
      <h2 className="text-2xl font-bold mb-2">Manage Distracted Categories</h2>
      <p className="text-sm text-gray-300 mb-4">
        Time spent in the following categories will trigger the distraction blocker during a focus session.
      </p>

      <div className="flex flex-wrap gap-2 bg-[#2a283e] p-4 rounded-lg mb-4">
        {selectedCategories.map((cat, idx) => (
          <span
            key={idx}
            className="bg-[#5d5fef] text-white px-4 py-1 rounded-full flex items-center gap-2 text-sm"
          >
            {cat}
            <button onClick={() => removeCategory(cat)} className="text-red-300 hover:text-red-500 text-lg font-bold">
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="bg-white text-black p-2 rounded"
        >
          <option value="">Select Category</option>
          {allCategories.map((cat, idx) => (
            <option key={idx} value={cat}>{cat}</option>
          ))}
        </select>

        <button
          onClick={addCategory}
          className="bg-[#5d5fef] hover:bg-[#4a4bda] px-4 py-2 text-white font-semibold rounded-lg"
        >
          Add Category
        </button>
      </div>
    </div>
  );
}
