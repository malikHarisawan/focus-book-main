"use client"

// Inspired by react-hot-toast library
import * as React from "react"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 5000 // Reduced from 1000000ms to 5000ms (5 seconds)

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
}

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

const toastTimeouts = new Map()

const addToRemoveQueue = (toastId) => {
  // Clear existing timeout for this toast if it exists
  if (toastTimeouts.has(toastId)) {
    const existingTimeout = toastTimeouts.get(toastId);
    clearTimeout(existingTimeout);
    console.log(`Cleared existing timeout for toast: ${toastId}`);
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
    console.log(`Toast auto-removed: ${toastId}`);
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
  console.log(`Added timeout for toast: ${toastId}`);
}

// Function to clear all pending timeouts
const clearAllTimeouts = () => {
  console.log(`Clearing ${toastTimeouts.size} pending toast timeouts`);
  toastTimeouts.forEach((timeout, toastId) => {
    clearTimeout(timeout);
    console.log(`Cleared timeout for toast: ${toastId}`);
  });
  toastTimeouts.clear();
}

// Function to clear specific timeout
const clearToastTimeout = (toastId) => {
  if (toastTimeouts.has(toastId)) {
    const timeout = toastTimeouts.get(toastId);
    clearTimeout(timeout);
    toastTimeouts.delete(toastId);
    console.log(`Manually cleared timeout for toast: ${toastId}`);
  }
}

export const reducer = (state, action) => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // Clear existing timeouts before adding new ones to remove queue
      if (toastId) {
        clearToastTimeout(toastId);
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          clearToastTimeout(toast.id);
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        // Clear all timeouts when removing all toasts
        clearAllTimeouts();
        return {
          ...state,
          toasts: [],
        }
      }
      // Clear specific timeout when removing specific toast
      clearToastTimeout(action.toastId);
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners = []

let memoryState = { toasts: [] }

function dispatch(action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

function toast(props) {
  const id = genId()

  const update = (props) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
      
      // Clear all timeouts when component unmounts
      if (listeners.length === 0) {
        console.log('Last toast listener removed, clearing all timeouts');
        clearAllTimeouts();
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId) => dispatch({ type: "DISMISS_TOAST", toastId }),
    clearAll: () => {
      clearAllTimeouts();
      dispatch({ type: "REMOVE_TOAST" });
    },
    getPendingTimeouts: () => toastTimeouts.size
  }
}

// Add this function for category toast notifications
function useCategoryChangeToast() {
  const { toast } = useToast()
  
  const showCategoryChangeToast = (appName, newCategory) => {
    toast({
      title: "Category Updated",
      description: `${appName} was categorized as "${newCategory}"`,
      duration: 3000,
    })
  }
  
  return { showCategoryChangeToast }
}

export { useToast, toast, useCategoryChangeToast, clearAllTimeouts }