from pathlib import Path
from setuptools import setup, find_packages

README = Path(__file__).with_name("README.md").read_text(encoding="utf-8")

setup(
    name="psytag",
    version="2026.07.dev5",  # PEP 440: YYYY.MM.devN
    description="Human Behavior Annotation Tool",
    long_description=README,
    long_description_content_type="text/markdown",
    author="ComPsy Group",
    author_email="tuncb@chop.edu",
    url="https://github.com/compsygroup/compsy-annotator",
    project_urls={
        "Documentation": "https://github.com/compsygroup/compsy-annotator/wiki",
        "Issues": "https://github.com/compsygroup/compsy-annotator/issues",
    },
    license="CC-BY-NC-4.0",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Science/Research",
        "Topic :: Scientific/Engineering",
        "License :: Other/Proprietary License",   # CC-BY-NC: no official Trove; use this
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3 :: Only",
        "Programming Language :: Python :: 3.8",
        "Operating System :: OS Independent",
    ],

    python_requires=">=3.8",
    package_dir={"": "src"},
    packages=find_packages("src"),

    # Include package data inside wheels
    # include_package_data=True,
    # package_data={"bitbox": ["data/*.csv"]},  # keep if data lives at src/bitbox/data/*.csv
    # zip_safe=False,

    install_requires=[
        "pydantic",
        "requests",
        "pymongo"
    ],
)