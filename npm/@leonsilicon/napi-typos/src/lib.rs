use napi::bindgen_prelude::{Error, Result};
use napi_derive::napi;
use typos_cli::{
    config::Config,
    policy::{ConfigEngine, ConfigStorage},
};

#[napi(object)]
pub struct Typo {
    pub word: String,
    /// One-based line number.
    pub line: u32,
    /// Zero-based UTF-8 byte offset within the line.
    pub byte_offset: u32,
    pub corrections: Vec<String>,
}

/// Check UTF-8 text with the upstream typos dictionary and optional typos TOML.
#[napi]
pub fn check_text(text: String, config_toml: Option<String>) -> Result<Vec<Typo>> {
    let cwd = std::env::current_dir().map_err(|error| Error::from_reason(error.to_string()))?;
    let storage = ConfigStorage::new();
    let mut engine = ConfigEngine::new(&storage);
    engine.set_isolated(true);
    if let Some(toml) = config_toml {
        let config =
            Config::from_toml(&toml).map_err(|error| Error::from_reason(error.to_string()))?;
        engine.set_overrides(config);
    }
    engine
        .init_dir(&cwd)
        .map_err(|error| Error::from_reason(error.to_string()))?;
    let stdin_path = cwd.join("-");
    let policy = engine.policy(&stdin_path);
    if !policy.check_files {
        return Ok(Vec::new());
    }

    let mut ignored = None;
    let mut line = 1;
    let mut line_start = 0;
    let mut newlines = text
        .match_indices('\n')
        .map(|(offset, _)| offset)
        .peekable();
    let mut findings = Vec::new();
    for typo in typos::check_str(&text, policy.tokenizer, policy.dict) {
        let ignored = ignored.get_or_insert_with(|| {
            policy
                .ignore
                .iter()
                .flat_map(|pattern| pattern.find_iter(&text).map(|entry| entry.range()))
                .collect::<Vec<_>>()
        });
        let span = typo.span();
        if ignored
            .iter()
            .any(|range| range.contains(&span.start) || range.contains(&span.end.saturating_sub(1)))
        {
            continue;
        }
        while let Some(end) = newlines.next_if(|end| *end < typo.byte_offset) {
            line += 1;
            line_start = end + 1;
        }
        let corrections = match typo.corrections {
            typos::Status::Corrections(words) => {
                words.into_iter().map(|word| word.into_owned()).collect()
            }
            _ => Vec::new(),
        };
        findings.push(Typo {
            word: typo.typo.into_owned(),
            line,
            byte_offset: u32::try_from(typo.byte_offset - line_start)
                .map_err(|error| Error::from_reason(error.to_string()))?,
            corrections,
        });
    }
    Ok(findings)
}
