# main.py
import json
import logging
import os  # noqa: F401
from typing import Any, Dict, TypedDict

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from pydantic import BaseModel

load_dotenv("./.env")

# Set up logging
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the language model

llm = ChatOpenAI(
    model_name="gpt-4o-mini",
    streaming=True,
)


# Define the state structure
class State(TypedDict):
    instruction: str
    draft: str
    edited_draft: str
    vietnamese_translation: str


# Define the agents
async def writer_agent(state: State) -> Dict[str, Any]:
    prompt = ChatPromptTemplate.from_messages(
        [
            SystemMessage(
                content="You are an email writer. Write an email based on the given instructions. Make sure it is less than 10 words"
            ),
            HumanMessage(content=state["instruction"]),
        ]
    )
    response = await llm.ainvoke(
        prompt.format_messages(instruction=state["instruction"])
    )
    state["draft"] = response.content
    return state


async def editor_agent(state: State) -> Dict[str, Any]:
    prompt = ChatPromptTemplate.from_messages(
        [
            SystemMessage(
                content="You are an email editor. Review and improve the given email draft. Start in a new line. Make sure it is less than 10 words"
            ),
            HumanMessage(
                content=f"Please review and improve this email draft:\n\n{state['draft']}"
            ),
        ]
    )
    response = await llm.ainvoke(prompt.format_messages(draft=state["draft"]))
    state["edited_draft"] = response.content
    return state


async def translator_agent(state: State) -> Dict[str, Any]:
    prompt = ChatPromptTemplate.from_messages(
        [
            SystemMessage(
                content="You are a professional translator. Translate the given English email into Vietnamese. Start in a new line. Make sure it is less than 10 words"
            ),
            HumanMessage(
                content=f"Please translate this email into Vietnamese:\n\n{state['edited_draft']}"
            ),
        ]
    )
    response = await llm.ainvoke(prompt.format_messages(email=state["edited_draft"]))
    state["vietnamese_translation"] = response.content
    return state


# Define the workflow
workflow = StateGraph(State)

# Add nodes to the graph
workflow.add_node("writer", writer_agent)
workflow.add_node("editor", editor_agent)
workflow.add_node("translator", translator_agent)

# Define edges
workflow.add_edge("writer", "editor")
workflow.add_edge("editor", "translator")
workflow.add_edge("translator", END)

# Set the entry point
workflow.set_entry_point("writer")

# Compile the graph
app_graph = workflow.compile()


# FastAPI route
class EmailRequest(BaseModel):
    instruction: str


@app.post("/generate_email")
async def generate_email(request: EmailRequest):
    instruction = request.instruction

    if not instruction:
        raise HTTPException(status_code=400, detail="Instruction is required")

    async def event_stream():
        stream_config = {}  # Add any specific configuration if needed
        agent_name = ""

        async for event in app_graph.astream_events(
            {
                "instruction": request.instruction,
                "draft": "",
                "edited_draft": "",
                "vietnamese_translation": "",
            },
            version="v1",
            config=stream_config,
        ):
            # print("Event received:", event)  # Log the raw event
            kind = event["event"]
            if kind == "on_chain_start":
                agent_name = event["name"]
                if agent_name in ["writer", "editor", "translator"]:
                    print("-" * 90)
                    print(f">>> Agent started: {agent_name}")
                    yield f"data: {json.dumps({'type': 'agent_start', 'agent': agent_name})}\n\n"

            elif kind == "on_chain_end":
                agent_name = event["name"]
                if agent_name in ["writer", "editor", "translator"]:
                    print(f"Agent ended: {agent_name}")
                    agent_output = event["data"].get("output", {})
                    yield f"data: {json.dumps({'type': 'agent_end', 'agent': agent_name, 'output': agent_output})}\n\n"

            elif kind == "on_chat_model_stream":
                print(event)
                content = event["data"]["chunk"].content
                if content:
                    print(">>> agent:", agent_name)
                    yield f"data: {json.dumps({'type': 'stream', 'content': content, 'agent': agent_name})}\n\n"

        print("Stream ended")
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
