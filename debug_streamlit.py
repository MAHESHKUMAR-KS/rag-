import streamlit as st
import sys
import os

st.title("Debug Info")
st.write(f"Python Version: {sys.version}")
st.write(f"Current Path: {os.getcwd()}")
st.write(f"Executable: {sys.executable}")

try:
    import torchvision
    st.write(f"torchvision version: {torchvision.__version__}")
except ImportError as e:
    st.error(f"Failed to import torchvision: {e}")

try:
    import torch
    st.write(f"torch version: {torch.__version__}")
except ImportError as e:
    st.error(f"Failed to import torch: {e}")

st.write("Site packages:")
st.write(sys.path)
