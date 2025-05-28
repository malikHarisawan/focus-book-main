import { Badge } from "../ui/badge"
import {
  Globe,
  CodeIcon,
  FileText,
  Video,
  BookOpen,
  MessageSquare,
  Package,
  User,
  Briefcase,
  Terminal,
} from "lucide-react"

export default function CategoryBadge({ category }) {
  const getProductivityColor = () => {
    switch (category) {
      case "Browsing":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30"
      case "Code":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
      case "Documenting":
        return "bg-green-500/10 text-green-400 border-green-500/30"
      case "Entertainment":
        return "bg-red-500/10 text-red-400 border-red-500/30"
      case "Learning":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30"
      case "Messaging":
      case "Communication":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
      case "Miscellaneous":
        return "bg-slate-500/10 text-slate-400 border-slate-500/30"
      case "Personal":
        return "bg-pink-500/10 text-pink-400 border-pink-500/30"
      case "Productivity":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30"
      case "Utility":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/30"
    }
  }

  const getCategoryIcon = () => {
    switch (category) {
      case "Browsing":
        return <Globe className="h-3.5 w-3.5 mr-1" />
      case "Code":
        return <CodeIcon className="h-3.5 w-3.5 mr-1" />
      case "Documenting":
        return <FileText className="h-3.5 w-3.5 mr-1" />
      case "Entertainment":
        return <Video className="h-3.5 w-3.5 mr-1" />
      case "Learning":
        return <BookOpen className="h-3.5 w-3.5 mr-1" />
      case "Messaging":
      case "Communication":
        return <MessageSquare className="h-3.5 w-3.5 mr-1" />
      case "Miscellaneous":
        return <Package className="h-3.5 w-3.5 mr-1" />
      case "Personal":
        return <User className="h-3.5 w-3.5 mr-1" />
      case "Productivity":
        return <Briefcase className="h-3.5 w-3.5 mr-1" />
      case "Utility":
        return <Terminal className="h-3.5 w-3.5 mr-1" />
      default:
        return <Package className="h-3.5 w-3.5 mr-1" />
    }
  }

  return (
    <Badge variant="outline" className={`${getProductivityColor()} text-xs flex items-center`}>
      {getCategoryIcon()}
      {category}
    </Badge>
  )
}