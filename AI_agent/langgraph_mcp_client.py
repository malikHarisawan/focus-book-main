# langgraph_mcp_client.py
from typing import List
from typing_extensions import TypedDict
from typing import Annotated

from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import tools_condition, ToolNode
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import AnyMessage, add_messages

from langchain_mcp_adapters.tools import load_mcp_tools
from langchain_mcp_adapters.resources import load_mcp_resources
from langchain_mcp_adapters.prompts import load_mcp_prompt
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from langchain_core.messages import HumanMessage, AIMessage
from langchain.memory import ConversationBufferMemory
from langchain_google_genai import ChatGoogleGenerativeAI
import asyncio
import os
import sys

# Get the directory where this script is located
current_dir = os.path.dirname(os.path.abspath(__file__))

# Launch the MCP server as a stdio subprocess.
#
# In a normal Python run, sys.executable is the interpreter, so we run
# `python math_mcp_server.py`. But under PyInstaller --onefile, sys.executable
# is ai_service.exe itself (there is no separate python), so `ai_service.exe
# math_mcp_server.py` would just re-launch the WEB SERVER — spawning another
# service that spawns another MCP subprocess, an infinite cascade.
#
# To make the frozen exe re-entrant, when frozen we invoke the exe with a
# sentinel flag (--run-mcp-server); start_service.py detects it and runs the
# MCP server code instead of the web server.
if getattr(sys, "frozen", False):
    server_params = StdioServerParameters(
        command=sys.executable,
        args=["--run-mcp-server"],
        env=os.environ.copy()
    )
else:
    server_params = StdioServerParameters(
        command=sys.executable,
        args=[os.path.join(current_dir, "math_mcp_server.py")],
        env=os.environ.copy()  # Pass all environment variables to subprocess
    )

async def create_graph(session):
    """
    Create LangGraph agent with AI model from environment variables.

    Environment variables (set by Electron app via start_service.py):
    - AI_PROVIDER: 'openai' or 'gemini' (default: 'openai')
    - OPENAI_API_KEY: API key for OpenAI
    - GEMINI_API_KEY: API key for Google Gemini
    """
    # Get AI provider from environment variable (default to 'openai')
    provider = os.getenv("AI_PROVIDER", "openai").lower()

    print(f"Initializing AI service with provider: {provider}")

    # Initialize LLM based on provider using environment variables
    if provider == "gemini":
        # Get Gemini API key from environment variable
        gemini_api_key = os.getenv("GEMINI_API_KEY")

        if not gemini_api_key:
            raise ValueError(
                "GEMINI_API_KEY environment variable is not set. "
                "Please configure your API key in the Settings page."
            )

        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0,
            api_key=gemini_api_key
        )
        print(f"Using Gemini model: gemini-2.5-flash")
    else:
        # Default to OpenAI
        # Get OpenAI API key from environment variable
        openai_api_key = os.getenv("OPENAI_API_KEY")

        if not openai_api_key:
            raise ValueError(
                "OPENAI_API_KEY environment variable is not set. "
                "Please configure your API key in the Settings page."
            )

        llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0,
            api_key=openai_api_key
        )
        print(f"Using OpenAI model: gpt-4o")

    tools = await load_mcp_tools(session)
    llm_with_tool = llm.bind_tools(tools)

    system_prompt = await load_mcp_prompt(session, "system_prompt")
    prompt_template = ChatPromptTemplate.from_messages([
        ("system", system_prompt[0].content),
        MessagesPlaceholder("messages")
    ])
    chat_llm = prompt_template | llm_with_tool

    class State(TypedDict):
        messages: Annotated[List[AnyMessage], add_messages]

    def chat_node(state: State) -> State:
        state["messages"] = chat_llm.invoke({"messages": state["messages"]})
        return state

    graph_builder = StateGraph(State)
    graph_builder.add_node("chat_node", chat_node)
    graph_builder.add_node("tool_node", ToolNode(tools=tools))
    graph_builder.add_edge(START, "chat_node")
    graph_builder.add_conditional_edges("chat_node", tools_condition, {"tools": "tool_node", "__end__": END})
    graph_builder.add_edge("tool_node", "chat_node")
    graph = graph_builder.compile()  
    return graph

async def main():
    config = {"configurable": {"thread_id": 1234}}

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            agent = await create_graph(session)

            #  Initialize LangChain memory
            memory = ConversationBufferMemory(return_messages=True)

            while True:
                user_input = input("User: ")
                memory.chat_memory.add_user_message(user_input)

                history = memory.chat_memory.messages
                response = await agent.ainvoke({"messages": history}, config=config)

                reply = response["messages"][-1]
                print(response)
                print("AI:", reply.content)

                memory.chat_memory.add_ai_message(reply.content)

if __name__ == "__main__":

    asyncio.run(main())
