from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from langchain.memory import ConversationBufferMemory

from datetime import datetime


from langgraph_mcp_client import create_graph, server_params
from mcp.client.stdio import stdio_client
from mcp import ClientSession

# === FastAPI App ===
app = FastAPI()

# Enable CORS (optional for frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Input Schema ===
class MessageInput(BaseModel):
    message: str

# === Global Variables ===

memory = ConversationBufferMemory(return_messages=True)
config = {"configurable": {"thread_id": 1234}}
stdio_cm = None
client_cm = None

last_reset_date = None  # Track the last date memory was reset

# === Helper Function ===
def reset_chat_memory():
    global memory, last_reset_date
    memory = ConversationBufferMemory(return_messages=True)
    last_reset_date = datetime.now().date()

# === Startup Event ===

@app.on_event("startup")
async def startup_event():
    global stdio_cm, client_cm

    # Setup stdio client and MCP session
    stdio_cm = stdio_client(server_params)
    read, write = await stdio_cm.__aenter__()

    client_cm = ClientSession(read, write)
    session = await client_cm.__aenter__()
    await session.initialize()

    # Store in app state
    app.state.session = session
    app.state.agent = await create_graph(session)


# === Shutdown Event ===
@app.on_event("shutdown")
async def shutdown_event():
    # Clean shutdown
    await client_cm.__aexit__(None, None, None)
    await stdio_cm.__aexit__(None, None, None)

# === Main Chat Endpoint ===
@app.post("/chat")
async def chat(req: MessageInput):
    global last_reset_date

    # Auto-reset memory once per day (not every request)
    if last_reset_date != datetime.now().date():
        reset_chat_memory()


    user_input = req.message
    memory.chat_memory.add_user_message(user_input)

    history = memory.chat_memory.messages
    try:
        print("INPUT HISTORY: [Messages received]")  # Avoid printing potentially problematic characters
    except:
        pass

    result = await app.state.agent.ainvoke({"messages": history}, config=config)

    # Fix Unicode encoding issue by using safe string handling
    try:
        print("RESULT: [Response received successfully]")  # Avoid printing potentially problematic characters
    except:
        pass
    try:
        reply = result["messages"][-1].content
    except Exception as e:
        reply = f"[ERROR extracting reply]: {e}"

    memory.chat_memory.add_ai_message(reply)

    return {"reply": reply}

# === Manual Reset Endpoint ===
@app.post("/reset")
async def reset():
    reset_chat_memory()
    return {"message": "Chat history has been cleared."}
