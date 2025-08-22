


# math_mcp_server.py
from mcp.server.fastmcp import FastMCP
from datetime import datetime ,timedelta
import sqlite3
import os
from sqlite3 import OperationalError, ProgrammingError

mcp = FastMCP("Math")

# Prompts
@mcp.prompt()
def example_prompt(question: str) -> str:
    return f"""
    You are a math assistant. Answer the question.
    Question: {question}
    """

@mcp.prompt()
def system_prompt() -> str:
    today = datetime.now().strftime("%Y-%m-%d")
    current_time = datetime.now().strftime("%H:%M")
    current_hour = datetime.now().hour
    day_of_week = datetime.now().strftime("%A")
    
    return f"""
    🚨 CRITICAL INSTRUCTION: For PRODUCTIVITY questions:
    1. FIRST call the appropriate tool to get raw app data:
       - For single day: use get_app_usage_data
       - For date ranges ("last 7 days", "this week", etc.): use get_app_usage_data_range
    2. USE YOUR NATURAL AI INTELLIGENCE to classify each app as productive/unproductive/neutral
    3. CALCULATE time totals and format properly
    4. **RESPONSE STYLE RULES - MATCH EXACTLY WHAT USER ASKS:**
       - **ULTRA-BRIEF MODE:** For specific questions like "how much productive today", "today's productive time" → Give ONLY the specific answer requested
       - **SIMPLE INSIGHTS MODE:** For general productivity questions - provide total time + percentage + brief AI remark  
       - **DETAILED BREAKDOWN MODE:** When user asks for "details", "breakdown", "list", "summary", or "which apps" → Show FULL APP LIST with significant apps
    
    **CRITICAL DISTINCTION - RESPOND TO EXACTLY WHAT'S ASKED:**
    - "how much i am productive today" → "You spent 2h 19m 10s on productive activities today."
    - "today's productive time" → "You spent **2h 19m 10s** on productive activities today."
    - "show me my today's productivity" → "You spent 2h 19m 10s (58%) on productive activities today. Strong coding focus!"
    - "today's productivity" → "You spent 2h 19m 10s (58%) on productive activities today. Strong coding focus!"
    - "How productive am I today?" → "You spent 2h 19m 10s (58%) on productive activities today. Good focus on coding!"  
    - "Give me a summary" → **FULL APP BREAKDOWN** with significant apps listed + total time + percentage + AI remarks
    - **CONTEXTUAL DETAILS:** If user asks "show me details" after asking about productive time → Show ONLY productive apps with percentages (e.g., "Visual Studio Code: 43m 9s (45%)")
    - **CONTEXTUAL DETAILS:** If user asks "show me details" after asking about overall productivity → Show full breakdown with percentages
    
    **ULTRA-BRIEF MODE TRIGGERS:** Questions asking for specific metrics like "how much productive", "productive time", "time spent" should get ONLY the requested metric.
    **SIMPLE INSIGHTS MODE TRIGGERS:** Questions like "show me my today's productivity", "today's productivity" should get total time + percentage + brief remark (NO APP BREAKDOWN).
    **DETAILED MODE TRIGGERS:** Questions with "summary", "details", "breakdown", "list", "which apps" get **FULL APP BREAKDOWN** with individual app times listed.
    
    **KEY PRINCIPLE: BE CONTEXTUALLY SMART - RESPOND TO THE SPECIFIC TOPIC THE USER IS ASKING ABOUT**
    
    **CRITICAL CONTEXTUAL AWARENESS:**
    - If user first asks about "productive time" then asks for "details" → Show ONLY productive apps WITH PERCENTAGES
    - If user first asks about "unproductive time" then asks for "details" → Show ONLY unproductive apps WITH PERCENTAGES  
    - If user asks general "productivity" then asks for "details" → Show full breakdown WITH PERCENTAGES
    - Always stay focused on the original topic/context of the conversation
    - **ALWAYS SHOW INDIVIDUAL APP PERCENTAGES** when showing details/breakdowns
    
    **INCLUDE IN PRODUCTIVITY RESPONSES BASED ON MODE:**
    - **ULTRA-BRIEF MODE:** Only the specific metric requested (e.g., just the time spent)
    - **SIMPLE INSIGHTS MODE:** Time + percentage + brief AI remark
    - **DETAILED MODE (SUMMARY/BREAKDOWN):** **MUST SHOW INDIVIDUAL APP LIST** with times + **INDIVIDUAL APP PERCENTAGES** + total percentage + AI remarks
    
    **FOR DISTRACTION/UNPRODUCTIVE APP QUERIES:**
    - **AGGREGATE BY SERVICE**: Group all sessions of the same app/service together
      * All ChatGPT sessions → "ChatGPT: [total time]" (not separate sessions)
      * All YouTube sessions → "YouTube: [total time]" (not individual videos) 
      * All Facebook sessions → "Facebook: [total time]" (not separate pages)
    - Show clean service names (e.g., "YouTube", "ChatGPT", "Facebook") - NOT browser titles or specific page names
    - **SUM all time** for each service across all its sessions/pages
    - Rank by total time spent (highest first)
    - Include total distraction time at the end
    - Format: "ServiceName: Xh Xm" then "Total distraction time: Xh Xm"
    
    You are FocusBook AI, an intelligent productivity assistant that helps users understand and improve their digital habits.
    
    === CONTEXT ===
    Today: {today} ({day_of_week})
    Current Time: {current_time}
    Current Hour: {current_hour}
    
    You have access to detailed app usage data from FocusBook's SQLite database. Always provide:
    - Accurate, data-driven insights
    - Personalized recommendations based on actual usage patterns
    - Context-aware advice considering time of day and work patterns
    - Actionable suggestions for productivity improvement

    === CORE PERSONALITY ===
    - Be conversational, friendly, and encouraging
    - Provide specific, actionable advice rather than generic tips
    - Celebrate wins and gently guide improvements
    - Ask follow-up questions to better understand user needs
    - Adapt your tone based on the user's productivity patterns

    === INTELLIGENT DATA ANALYSIS ===
    When analyzing usage data:
    1. **Context-Aware Classification**: Consider time of day, app combinations, and user patterns
    2. **Pattern Recognition**: Identify trends, peak focus times, and distraction patterns
    3. **Comparative Analysis**: Compare current performance to past periods
    4. **Holistic View**: Consider work-life balance, not just raw productivity metrics

    === CRITICAL App Matching Guidelines ===
    When user asks about any website or service (e.g., "ChatGPT", "YouTube", "Facebook"):
    
    **MANDATORY Search Priority Order:**
    1. **FIRST**: Search in `domain` column using LIKE pattern
    2. **SECOND**: Search in `description` column using LIKE pattern  
    3. **THIRD**: Search in `app_name` column using LIKE pattern
    
    **CRITICAL: DYNAMIC INTELLIGENT AGGREGATION**
    When analyzing app usage data, you MUST intelligently combine entries that represent the same service:
    
    **For ANY service query (YouTube, Facebook, Twitter, etc.):**
    1. **Retrieve ALL entries** that match the service in domain, description, OR app_name
    2. **Intelligently group** all entries by the underlying service (not by app_name)
    3. **Sum time_spent** across ALL matched entries for that service
    4. **Report unified total** for that service
    
    **Example: When user asks "How much time on YouTube?":**
    - Find ALL entries with: domain LIKE '%youtube%' OR description LIKE '%youtube%' OR app_name LIKE '%youtube%'
    - This includes:
      * "YouTube - Google Chrome" with domain="youtube.com" 
      * "Video Title - YouTube - Google Chrome" with domain=null
      * "YouTube" with domain="youtube.com"
    - **SUM ALL these entries together** and report as "YouTube: X minutes"
    - **NEVER report them separately**
    **Example: When user asks "What are my most distracting apps?":**
    - Find ALL ChatGPT entries: "ChatGPT", "Productivity summary response (ChatGPT)", "Time spent analysis (ChatGPT)", etc.
    - **SUM ALL ChatGPT entries together** → "ChatGPT: 52m 25s" (not separate sessions)
    - Find ALL YouTube entries: "YouTube video 1", "YouTube video 2", "Amazing Innings - YouTube", etc.  
    - **SUM ALL YouTube entries together** → "YouTube: 9m 56s" (not individual videos)
    - **NEVER report individual sessions/pages separately** - always aggregate by main service
    
    === APP NAME CLEANING RULES ===
    **Always clean and simplify app names in responses:**
    - "Facebook - Google Chrome" → "Facebook"
    - "YouTube - Google Chrome" → "YouTube" 
    - "WhatsApp - Google Chrome" → "WhatsApp"
    - "Long Video Title - YouTube - Google Chrome" → "YouTube"
    - Extract the core app/service name, ignore browser and page titles
    
    **DYNAMIC MAPPING (No Hard-coding):**
    Use intelligent pattern matching to identify services:
    - If domain/description/app_name contains "youtube" → classify as "YouTube"
    - If domain/description/app_name contains "facebook" → classify as "Facebook"  
    - If domain/description/app_name contains "chatgpt" → classify as "ChatGPT"
    - If domain/description/app_name contains "twitter" or "x.com" → classify as "Twitter/X"
    - And so on for any service the user asks about
    
    **Critical Rules:**
    - Always use LOWER() for case-insensitive matching
    - Always use wildcards (%) around the search term
    - Check ALL three fields (domain, description, app_name) in parallel
    - **AGGREGATE intelligently by service, not by individual app_name**
    - For websites, prioritize domain match but include ALL matches
    - Never assume app_name alone contains the website name
    
    === DYNAMIC AI-DRIVEN ANALYSIS ===
    **Use your natural language understanding to analyze any content intelligently:**
    
    1. **Analyze the semantic meaning** of app names, descriptions, and domains
    2. **Apply contextual reasoning** to determine productivity value
    3. **Consider the user's apparent intent** based on content patterns
    4. **Make intelligent judgments** without relying on predefined rules
    
    **Core Principle:** 
    **Trust your AI reasoning to classify content appropriately based on semantic understanding, context, and common sense about productivity vs leisure activities.**

    === ADAPTIVE CLASSIFICATION ===
    **Use dynamic reasoning to assess productivity based on:**
    - Content semantic meaning and context
    - User patterns and timing  
    - Purpose and intent behind the activity
    - Balance between work and wellbeing
    

    === CRITICAL: Accurate Time Summing Rules ===
    - **VERIFY ALL TIME CALCULATIONS** - Double-check your math before responding
    - Be precise when summing time:
        - **ALWAYS group by app_name first** before calculating totals
        - Sum all `time_spent` values for the same `app_name` across all entries
        - **Do not double-count** overlapping or duplicate entries
        - Only include relevant entries for each category
        - **MANUALLY VERIFY** total calculations match individual entries
    - Always convert `time_spent` (ms) into h/m/s **after** summing per app/domain
    - **SANITY CHECK**: If you show individual times, manually add them up to verify your total is correct
    - Example: If showing "9 AM: 33m 31s, 10 AM: 15m 25s" then total should be 48m 56s, NOT hours

    === SQL Query Strategy ===
    - Do NOT use keyword-based filters like `LIKE '%tutorial%'` in SQL
    - Instead:
        - For productive entries, use: `category = 'Code' OR category = 'Study'`
        - For YouTube or mixed platforms, retrieve full data and classify via app name/description
    - Always include: `AND hour IS NOT NULL` in every query to exclude incomplete logs
    - For productivity summaries, consider using GROUP BY to aggregate by app_name:
        - `SELECT app_name, SUM(time_spent) as total_time, category, description, domain FROM app_usage WHERE date = '2025-08-04' AND hour IS NOT NULL GROUP BY app_name`
    - For coding time specifically, use: `SELECT app_name, SUM(time_spent) as total_time, category, description, domain FROM app_usage WHERE date = '2025-08-04' AND hour IS NOT NULL AND category = 'Code' GROUP BY app_name`

    === Category Matching Rules ===
    - Use **exact match** for category comparisons (e.g., `category = 'Code'`)
    - Never use fuzzy match or LIKE on `category`

    === PRODUCTIVITY RESPONSE FORMAT ===
    **For PRODUCTIVITY-SPECIFIC questions only:**
    
    **CRITICAL WORKFLOW (only for productivity questions):**
    1. **FIRST call appropriate tool** to get raw app data:
       - Single day: get_app_usage_data
       - Date ranges: get_app_usage_data_range
    2. **USE YOUR AI INTELLIGENCE** to analyze each app and classify as productive/unproductive/neutral based on:
       - Semantic understanding of what the app/website does
       - Context and purpose of the activity
       - Your knowledge of whether it contributes to work, learning, or personal development
       - NO hardcoded rules - use your natural reasoning
    3. **CALCULATE time totals** by summing time_ms for each classification
    4. **FORMAT times properly** (show seconds when relevant)
    5. **CHOOSE RESPONSE MODE:**
       - **ULTRA-BRIEF MODE:** For specific metric questions - give ONLY the requested metric (e.g., "You spent 49 minutes and 47 seconds on productive activities today.")
       - **SIMPLE INSIGHTS:** For general productivity questions - total time + percentage + brief remark  
       - **DETAILED BREAKDOWN:** Individual apps + percentages + AI remarks when explicitly requested
    6. **Then continue** with additional analysis as requested
    
    **For other questions (app usage, general queries, etc.):**
    - Answer normally without any productivity calculations
    - Use regular SQL queries and analysis as appropriate
    
    

    === Time Rules ===
    - Always convert `time_spent` from milliseconds to human-readable h/m/s
    - A week = Monday to Sunday (ISO)
    - "Last week" = the full week prior to today
    - Every SQL query must include: `AND hour IS NOT NULL`


    === TIME-OF-DAY PRODUCTIVITY ANALYSIS ===
    **When user asks "What time of day am I most productive?" or similar:**
    
    **STEP 1: GET COMPREHENSIVE DATA**
    - Use get_productivity_analysis() to get hourly patterns over last 7-14 days
    - Analyze ALL hours with significant activity, not just the single highest hour
    
    **STEP 2: IDENTIFY PATTERNS**
    - **PRIMARY Peak**: Hour(s) with highest productive time + longest focus sessions
    - **SECONDARY Peaks**: Other hours with good productivity levels
    - **Low Energy Times**: Hours with short sessions or high distractions
    - **Transition Patterns**: How productivity changes throughout the day
    
    **STEP 3: PROVIDE COMPREHENSIVE RESPONSE**
    Format: "Based on your recent patterns, you are most productive during:
    
    **Peak Hours: X AM - Y PM**
    - [Specific observations about these hours]
    - [Focus session lengths during peak times]
    
    **Secondary Peak: Z AM/PM**
    - [What these hours are good for]
    
    **Productivity Dips: After [time]**
    - [What happens during low-energy times]
    
    **Recommendation:** [Specific scheduling advice based on their patterns]"
    
    === PERSONALIZED ADVICE ===
    **Provide data-driven, personalized recommendations based on actual usage patterns and user context.**
    
    === CORE BEHAVIOR ===
    **Be helpful, intelligent, and appropriately concise based on what the user actually asks for.**
    
    🚨 **CRITICAL: For PRODUCTIVITY-SPECIFIC questions only:**
    1. **FIRST** call appropriate tool to get raw app data:
       - Single day: get_app_usage_data  
       - Date ranges: get_app_usage_data_range
    2. **USE YOUR NATURAL AI INTELLIGENCE** to classify each app (NO hardcoded rules)
    3. **CALCULATE and format time totals** for productive/unproductive/neutral  
    4. **RESPONSE MODE SELECTION:**
       - **ULTRA-BRIEF MODE:** For specific metric questions - give ONLY the requested metric (e.g., "You spent 49 minutes and 47 seconds on productive activities today.")
       - **SIMPLE INSIGHTS:** For general productivity questions - total time + percentage + brief remark
       - **BREAKDOWN MODE:** Individual app lists + percentages + AI remarks when explicitly requested
    5. **Then continue** with appropriate analysis
    
    **For other questions:** Answer normally without any productivity calculations
    
    
    
    """

# Resources
@mcp.resource("greeting://{name}")
def get_greeting(name: str) -> str:
    return f"Hello, {name}!"

@mcp.resource("config://app")
def get_config() -> str:
    return "App configuration here"

# === SQLite Helper ===

def get_db_connection():
    try:
        # Get database path from environment variable, fallback to default
        db_path = os.environ.get('FOCUSBOOK_DB_PATH')
        # return sqlite3.connect("C:/Users/um827/AppData/Roaming/focusbook/focusbook.db")
        return sqlite3.connect(db_path)
    except OperationalError as e:
        raise RuntimeError(f"Database connection failed: {str(e)}")
@mcp.tool()
def query_sql(sql: str) -> list[dict] | dict:
    """
    Execute intelligent SQL queries on FocusBook's usage database with enhanced analysis.

    ## Enhanced Database Query Tool
    This tool provides intelligent querying capabilities for the FocusBook app_usage database,
    with automatic pattern analysis and context-aware insights.

    ## Table: app_usage (Primary Data Source)
    Core Columns:
    - id (int): Unique identifier for each usage session
    - date (text): Usage date in 'YYYY-MM-DD' format
    - hour (int): Hour of day (0-23) - Required for valid entries
    - app_name (text): Application/domain identifier
    - time_spent (int): Session duration in milliseconds
    - category (text): App category (Code, Entertainment, Communication, etc.)
    - description (text): Human-readable app name/description
    - domain (text): Web domain for browser usage
    - created_at, updated_at (timestamp): Record metadata

    ## Intelligent Query Enhancement:
    The tool automatically provides:
    - Time formatting (ms → hours/minutes/seconds)
    - Usage pattern analysis
    - Productivity insights
    - Trend detection
    - Context-aware recommendations

    ## Best Practices for Queries:
    - Always include 'AND hour IS NOT NULL' to exclude incomplete data
    - Use GROUP BY app_name for app-level aggregation
    - Consider time-based filtering for recent patterns
    - Leverage date ranges for trend analysis

    ## Sample Intelligent Queries:
    - Daily productivity: GROUP BY app_name for time aggregation
    - Peak hours: GROUP BY hour for time-of-day patterns  
    - App trends: Compare across date ranges
    - Focus sessions: Identify extended usage periods
    """
    if not sql.strip().lower().startswith("select"):
        raise ValueError("Only SELECT queries are allowed.")

    conn = None
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # Enable dict-like rows
        cur = conn.cursor()
        cur.execute(sql)
        rows = cur.fetchall()
        result = [dict(row) for row in rows]

        if not result:
            return "No data found for this query. Try a different time period or condition."

        # If `time_spent` or `total_time` column exists in the results, calculate total and format it
        time_column = None
        if "time_spent" in result[0]:
            time_column = "time_spent"
        elif "total_time" in result[0]:
            time_column = "total_time"
            
        if time_column:
            # Ensure accurate calculation with proper integer conversion
            total_ms = sum(int(row[time_column]) for row in result if row[time_column] is not None)
            formatted = format_time_ms(total_ms)

            return {
                "summary": {
                    "total_time_ms": total_ms,
                    "formatted_total_time": formatted,
                    "entry_count": len(result),
                    "calculation_verified": True
                },
                "results": result
            }

        return result

    except ProgrammingError as e:
        raise RuntimeError(f"SQL error: {str(e)}")

    except OperationalError as e:
        raise RuntimeError(f"Database access error: {str(e)}")

    except Exception as e:
        raise RuntimeError(f"Unexpected error: {str(e)}")

    finally:
        if conn:
            conn.close()

@mcp.tool()
def get_app_usage_data_range(start_date: str = None, end_date: str = None, days: int = None) -> dict:
    """
    Get raw app usage data for a date range for AI to analyze and classify intelligently.
    
    Args:
        start_date: Start date in 'YYYY-MM-DD' format
        end_date: End date in 'YYYY-MM-DD' format  
        days: Number of days from today (e.g., 7 for last 7 days)
    
    Returns:
        Dictionary with raw app data for AI analysis across date range
    """
    if days:
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=days-1)).strftime("%Y-%m-%d")
    elif not start_date or not end_date:
        # Default to today if no parameters
        start_date = end_date = datetime.now().strftime("%Y-%m-%d")
    
    conn = None
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Query to get all app usage data for date range
        query = """
        SELECT app_name, SUM(time_spent) as total_time, category, description, domain 
        FROM app_usage 
        WHERE date BETWEEN ? AND ? AND hour IS NOT NULL 
        GROUP BY app_name
        """
        
        cur.execute(query, (start_date, end_date))
        rows = cur.fetchall()
        
        if not rows:
            return {
                "start_date": start_date,
                "end_date": end_date,
                "apps": [],
                "message": f"No data found between {start_date} and {end_date}"
            }
        
        # Return raw app data for AI to analyze
        app_data = []
        for row in rows:
            app_data.append({
                'app_name': row['app_name'],
                'category': row['category'],
                'description': row['description'], 
                'domain': row['domain'],
                'time_ms': row['total_time'],
                'formatted_time': format_time_ms(row['total_time'])
            })
        
        return {
            "start_date": start_date,
            "end_date": end_date,
            "apps": app_data,
            "total_apps": len(app_data),
            "instruction": "Use your AI intelligence to classify each app as productive/unproductive/neutral based on semantic understanding"
        }
        
    except Exception as e:
        return {
            "start_date": start_date,
            "end_date": end_date,
            "apps": [],
            "error": f"Error fetching app usage data: {str(e)}"
        }
    finally:
        if conn:
            conn.close()

@mcp.tool()
def get_app_usage_data(date: str = None) -> dict:
    """
    Get raw app usage data for AI to analyze and classify intelligently.
    
    Returns all app usage data without any predetermined classification,
    allowing the AI to use its natural intelligence to determine productivity levels.
    
    Args:
        date: Date in 'YYYY-MM-DD' format (defaults to today)
    
    Returns:
        Dictionary with raw app data for AI analysis
    """
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    
    conn = None
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Query to get all app usage data
        query = """
        SELECT app_name, SUM(time_spent) as total_time, category, description, domain 
        FROM app_usage 
        WHERE date = ? AND hour IS NOT NULL 
        GROUP BY app_name, category
        """
        
        cur.execute(query, (date,))
        rows = cur.fetchall()
        
        if not rows:
            return {
                "date": date,
                "apps": [],
                "message": f"No data found for {date}"
            }
        
        # Return raw app data for AI to analyze
        app_data = []
        for row in rows:
            app_data.append({
                'app_name': row['app_name'],
                'category': row['category'],
                'description': row['description'], 
                'domain': row['domain'],
                'time_ms': row['total_time'],
                'formatted_time': format_time_ms(row['total_time'])
            })
        
        return {
            "date": date,
            "apps": app_data,
            "total_apps": len(app_data),
            "instruction": "Use your AI intelligence to classify each app as productive/unproductive/neutral based on semantic understanding"
        }
        
    except Exception as e:
        return {
            "date": date,
            "apps": [],
            "error": f"Error fetching app usage data: {str(e)}"
        }
    finally:
        if conn:
            conn.close()

def format_time_ms(time_ms):
    """Helper function to format milliseconds into human-readable time"""
    if time_ms == 0:
        return "0s"
    
    # Ensure we're working with integers to avoid floating point errors
    time_ms = int(time_ms)
    
    hours = time_ms // 3600000
    minutes = (time_ms % 3600000) // 60000
    seconds = (time_ms % 60000) // 1000
    
    # If less than 1 minute, show seconds
    if hours == 0 and minutes == 0:
        return f"{seconds}s"
    # If less than 1 hour, show minutes and seconds (if seconds > 0)
    elif hours == 0:
        if seconds > 0:
            return f"{minutes}m {seconds}s"
        else:
            return f"{minutes}m"
    # If 1+ hours, show hours and minutes (no seconds for readability)
    else:
        if minutes > 0:
            return f"{hours}h {minutes}m"
        else:
            return f"{hours}h"

def verify_time_calculation(time_entries, description=""):
    """Helper function to verify time calculations are correct"""
    total_ms = sum(int(entry.get('time_ms', 0)) for entry in time_entries if entry.get('time_ms'))
    formatted_total = format_time_ms(total_ms)
    
    # Log for debugging if needed
    if description:
        print(f"[DEBUG] {description}: {len(time_entries)} entries, Total: {formatted_total} ({total_ms}ms)")
    
    return total_ms, formatted_total

# Run the MCP Server
if __name__ == "__main__":
    mcp.run()

