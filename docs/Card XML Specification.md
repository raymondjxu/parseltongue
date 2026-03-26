# Card XML Specification

## Overview

Card XML is an XML formatted document that uses XML to notate the parts of a debate card. Everything is contained within a single root `<file>` element, with support for four hierarchical organizational sections (pockets, hats, blocks, and tags) that mirror Verbatim's debate file structure. Cards contain highlighted text portions that represent the key information for human consumption.

## Root Element

All card data must be wrapped in a single root element:

```xml
<file>
  <!-- Card definitions go here -->
</file>
```

## Card Structure

Each card contains the following required components:

```xml
<card red="true">
  <tag>...</tag>
  <cite>...</cite>
  <cardText>...</cardText>
</card>
```

### Components

- **tag**: A label or identifier for the card
- **cite**: Source attribution or reference information
- **cardText**: The main content of the card, which may contain highlighted portions
- **red** (attribute): Optional boolean attribute on `<card>` set to `true` when the source text is already redlined

## Card Text with Highlights

The `cardText` element can contain static text and highlighted portions. Only highlighted text sections are intended to be read by humans:

```xml
<cardText>
  Some introductory text
  <highlight>This is the key information humans read</highlight>
  More context here
  <highlight>Another important part</highlight>
</cardText>
```

## Organizational Sections

Cards are organized using four hierarchical section types, corresponding to Verbatim's organizational structure:

### pocket (Heading 1)

The top-level organizational container, analogous to an expando pocket in a debate file:

```xml
<pocket>
  <title>Pocket Title</title>
  <!-- Hats, blocks, and cards go here -->
</pocket>
```

### hat (Heading 2)

Meta-information or introductory wrapper for a grouping of related blocks:

```xml
<hat>
  <title>Hat Title</title>
  <!-- Blocks and cards go here -->
</hat>
```

### block (Heading 3)

A structural container that groups related cards together:

```xml
<block>
  <title>Block Title</title>
  <!-- Cards go here -->
</block>
```

### tag (Heading 4)

Individual card identifier and metadata:

## Complete Example

```xml
<file>
  <pocket>
    <title>Common Phrases</title>
    
    <hat>
      <title>Essential Vocabulary</title>
      
      <block>
        <title>Greetings</title>
        
        <card red="true">
          <tag>Humans greet each other.</tag>
          <cite>Standard usage</cite>
          <cardText>
            A common way to say hello:
            <highlight>Hello, how are you?</highlight>
          </cardText>
        </card>
        
        <card>
          <tag>They also say goodbye.</tag>
          <cite>Polite form</cite>
          <cardText>
            Formal goodbye:
            <highlight>Goodbye, see you later</highlight>
          </cardText>
        </card>
      </block>
    </hat>
  </pocket>
  
  <pocket>
    <title>Advanced Expressions</title>
    
    <hat>
      <title>For Intermediate Learners</title>
      
      <block>
        <title>Idioms</title>
        
        <card>
          <tag>This is an idiom</tag>
          <cite>Native speakers</cite>
          <cardText>
            When someone is very busy or occupied:
            <highlight>They have a lot on their plate</highlight>
          </cardText>
        </card>
      </block>
    </hat>
  </pocket>
</file>
```

## Key Principles

1. **Single Root**: All content is wrapped in a `<file>` root element (representing a complete debate file or expando)
2. **Hierarchical Organization**: Four organizational levels mirror Verbatim's structure:
   - `<pocket>` = Heading 1 (largest containers, like expando pockets)
   - `<hat>` = Heading 2 (labeled groupings within pockets)
   - `<block>` = Heading 3 (containers for related cards)
   - `<tag>` = Heading 4 (individual card identifiers)
3. **Card Attribution**: Each card includes `tag` for identification, `cite` for source, and `cardText` for content; set the optional `red="true"` attribute when the source text is already redlined
4. **Human-Readable Focus**: Highlighted portions within `cardText` represent the information intended for human consumption
5. **Flexible Nesting**: Sections can be nested following the hierarchy to create complex organizational structures
6. **Optional Elements**: Not all organizational levels need to be used; structure based on content complexity

