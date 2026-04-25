/// <reference path="../node_modules/pxt-core/localtypings/pxtblockly.d.ts"/>

const pxtblockly = pxt.blocks.requirePxtBlockly()
const Blockly = pxt.blocks.requireBlockly();

export interface FieldMusicOptions {
    columns?: string;
    width?: string;
    addLabel?: string;
}

declare const pxtTargetBundle: any;

let soundCache: any;
let soundIconCache: any;
let soundIconCacheArray: any;

export class FieldMusic extends pxtblockly.FieldImages {

    public isFieldCustom_ = true;

    private selectedCategory_: string;
    private categoriesCache_: string[];

    constructor(text: string, options: FieldMusicOptions, validator?: Function) {
        super(text, options as any, validator);

        this.columns_ = parseInt(options.columns) || 4;
        this.width_ = parseInt(options.width) || 450;

        this.addLabel_ = true;

        this.updateSize_ = (Blockly.Field as any).prototype.updateSize_;

        if (!pxt.BrowserUtils.isIE() && !soundCache) {
            soundCache = JSON.parse(pxtTargetBundle.bundledpkgs['music']['sounds.jres']);
        }
        if (!soundIconCache) {
            soundIconCache = JSON.parse(pxtTargetBundle.bundledpkgs['music']['icons.jres']);
            soundIconCacheArray = Object.entries(soundIconCache).filter(el => el[0] !== "*");
        }
    }

    /**
     * Create a dropdown menu under the text.
     * @private
     */
    public showEditor_(e?: Event) {
        this.setOpeningPointerCoords(e);
        // If there is an existing drop-down we own, this is a request to hide the drop-down.
        if (Blockly.DropDownDiv.hideIfOwner(this)) {
            return;
        }
        let sourceBlock = this.sourceBlock_ as any;
        // If there is an existing drop-down someone else owns, hide it immediately and clear it.
        Blockly.DropDownDiv.hideWithoutAnimation();
        Blockly.DropDownDiv.clearContent();
        // Populate the drop-down with the icons for this field.
        let dropdownDiv = Blockly.DropDownDiv.getContentDiv() as HTMLElement;
        let contentDiv = document.createElement('div');
        // Accessibility properties
        dropdownDiv.setAttribute('class', 'blocklyDropDownMusicContent');
        contentDiv.setAttribute('role', 'menu');
        contentDiv.setAttribute('aria-haspopup', 'true');
        contentDiv.setAttribute('class', 'blocklyMusicFieldOptions');
        this.addPointerListener(dropdownDiv);
        this.addKeyDownHandler(contentDiv);
        const options = this.getOptions();
        //if (this.shouldSort_) options.sort(); // Do not need to use to not apply sorting in different languages
        
        // Create categoies
        const categories = this.getCategories(options);
        const selectedCategory = this.parseCategory(this.getText());
        this.selectedCategory_ = selectedCategory || categories[0];

        let categoriesDiv = document.createElement('div');
        // Accessibility properties
        categoriesDiv.setAttribute('role', 'menu');
        categoriesDiv.setAttribute('aria-haspopup', 'true');
        categoriesDiv.className = 'blocklyMusicFieldCategories';
        categoriesDiv.style.backgroundColor = sourceBlock.getColourTertiary();
        categoriesDiv.style.width = (this as any).width_ + 'px';

        this.refreshCategories(categoriesDiv, categories);
        this.refreshOptions(contentDiv, options);

        dropdownDiv.appendChild(categoriesDiv);
        dropdownDiv.appendChild(contentDiv);

        Blockly.DropDownDiv.setColour(this.sourceBlock_.getColour(), sourceBlock.getColourTertiary());
        
        // Position based on the field position.
        Blockly.DropDownDiv.showPositionedByField(this, this.onHideCallback.bind(this));

        contentDiv.focus();

        // Update colour to look selected.
        this.savedPrimary_ = sourceBlock?.getColour();
        if (sourceBlock?.isShadow()) {
            sourceBlock.setColour(sourceBlock.style.colourTertiary);
        } else if (this.borderRect_) {
            this.borderRect_.setAttribute('fill', sourceBlock.style.colourTertiary);
        }
    }

    getCategories(options: any) {
        if (this.categoriesCache_) return this.categoriesCache_;
        let categoryMap = {};
        for (let i = 0, option: any; option = options[i]; i++) {
            const content = (options[i] as any)[0]; // Human-readable text or image.
            const category = this.parseCategory(content);
            categoryMap[category] = true;
        }
        this.categoriesCache_ = Object.keys(categoryMap);
        return this.categoriesCache_;
    }

    refreshCategories(categoriesDiv: Element, categories: string[]) {
        // Show category dropdown.
        for (let i = 0; i < categories.length; i++) {
            const category = categories[i];

            let button = document.createElement('button');
            button.setAttribute('id', ':' + i); // For aria-activedescendant
            button.setAttribute('role', 'menuitem');
            button.setAttribute('class', 'blocklyDropdownTag');
            button.setAttribute('data-value', category);

            let backgroundColor = '#1A9DBC';
            if (category == this.selectedCategory_) {
                // This icon is selected, show it in a different colour
                backgroundColor = '#0c4e5e';
                button.setAttribute('aria-selected', 'true');
            }
            button.style.padding = "2px 6px";
            button.style.backgroundColor = backgroundColor;
            button.style.borderColor = backgroundColor;
            Blockly.browserEvents.bind(button, 'click', this, this.categoryClick_);
            Blockly.browserEvents.bind(button, 'mouseup', this, this.categoryClick_);

            const textNode = this.createTextNode_(category);
            textNode.setAttribute('data-value', category);
            button.appendChild(textNode);
            categoriesDiv.appendChild(button);
        }
    }

    refreshOptions(contentDiv: Element, options: any) {
        let sourceBlock = this.sourceBlock_ as any;
        const categories = this.getCategories(options);
        let row = this.createRow();
        // Show options
        for (let i = 0, option: any; option = options[i]; i++) {
            const content = (options[i] as any)[0]; // Human-readable text or image.
            const value = (options[i] as any)[1]; // Language-neutral value.

            // Filter for options in selected category
            const category = this.parseCategory(content);
            if (this.selectedCategory_ != category) continue;

            // Icons with the type property placeholder take up space but don't have any functionality
            // Use for special-case layouts
            if (content.type == 'placeholder') {
                let placeholder = document.createElement('span');
                placeholder.setAttribute('class', 'blocklyDropDownPlaceholder');
                placeholder.style.width = content.width + 'px';
                placeholder.style.height = content.height + 'px';
                contentDiv.appendChild(placeholder);
                continue;
            }
            const buttonContainer = document.createElement('div');
            buttonContainer.setAttribute('class', 'blocklyDropDownButtonContainer')
            let button = document.createElement('div');
            button.setAttribute('id', ':' + i); // For aria-activedescendant
            button.setAttribute('role', 'gridcell');
            button.setAttribute('aria-selected', 'false');
            button.setAttribute('class', 'blocklyDropDownButton');
            button.title = content;
            if ((this as any).columns_) {
                button.style.width = (((this as any).width_ / (this as any).columns_) - 8) + 'px';
                //button.style.height = ((this.width_ / this.columns_) - 8) + 'px';
            } else {
                button.style.width = content.width + 'px';
                button.style.height = content.height + 'px';
            }
            let backgroundColor = this.savedPrimary_ || sourceBlock.getColour();
            if (value == this.getValue()) {
                // This icon is selected, show it in a different colour
                backgroundColor = sourceBlock.getColourTertiary();
                button.setAttribute('aria-selected', 'true');
                this.activeDescendantIndex = i;
                contentDiv.setAttribute('aria-activedescendant', button.id);
                button.setAttribute('class', `blocklyDropDownButton ${this.openingPointerCoords ? "blocklyDropDownButtonHover" : "blocklyDropDownButtonFocus"}`);
            }
            button.style.backgroundColor = backgroundColor;
            button.style.borderColor = sourceBlock.getColourTertiary();
            Blockly.browserEvents.bind(button, 'click', this, () => this.buttonClickAndClose_(value));
            Blockly.browserEvents.bind(button, 'mouseenter', button, () => this.buttonEnter_(value));
            Blockly.browserEvents.bind(button, 'mouseleave', button, () => this.buttonLeave_());
            Blockly.browserEvents.bind(button, 'pointermove', this, () => {
                if (this.pointerMoveTriggeredByUser()) {
                    this.gridItems.forEach(button => button.setAttribute('class', 'blocklyDropDownButton'));
                    this.activeDescendantIndex = i;
                    button.setAttribute('class', 'blocklyDropDownButton blocklyDropDownButtonHover');
                    contentDiv.setAttribute('aria-activedescendant', button.id);
                }
            });
            Blockly.browserEvents.bind(button, 'pointerout', this, () => {
                if (this.pointerOutTriggeredByUser()) {
                    button.setAttribute('class', 'blocklyDropDownButton');
                    contentDiv.removeAttribute('aria-activedescendant');
                    this.activeDescendantIndex = undefined;
                }
            });

            // Find index in array by category name
            const categoryIndex = categories.indexOf(category);

            let buttonImg = document.createElement('img');
            buttonImg.src = this.getSoundIcon(categoryIndex);
            //buttonImg.alt = icon.alt;
            // Upon click/touch, we will be able to get the clicked element as e.target
            // Store a data attribute on all possible click targets so we can match it to the icon.
            button.setAttribute('data-value', value);
            buttonImg.setAttribute('data-value', value);
            button.appendChild(buttonImg);

            if (this.addLabel_) {
                const buttonText = this.createTextNode_(content);
                buttonText.setAttribute('data-value', value);
                if (pxt.Util.userLanguage() !== "en") {
                    buttonText.setAttribute('lang', pxt.Util.userLanguage()); // for hyphens, here you need to set the correct abbreviation of the selected language
                }
                button.appendChild(buttonText);
            }

            this.gridItems.push(button);
            buttonContainer.appendChild(button);
            row.append(buttonContainer);
            if (row.childElementCount === this.columns_) {
                contentDiv.appendChild(row);
                row = this.createRow();
            }
        }
        if (row.childElementCount) {
            contentDiv.appendChild(row);
        }
    }

    protected onHide_() {
        super.onHide_();
        (Blockly.DropDownDiv.getContentDiv() as HTMLElement).style.maxHeight = '';
        this.stopSounds();
        // Update color (deselect) on dropdown hide
        let source = this.sourceBlock_ as any;
        if (source?.isShadow()) {
            source.setColour(this.savedPrimary_);
        } else if (this.borderRect_) {
            this.borderRect_.setAttribute('fill', this.savedPrimary_);
        }
    }

    protected createTextNode_(content: string) {
        const category = this.parseCategory(content);
        let text = content.slice(content.indexOf(' ') + 1);
        
        const textSpan = document.createElement('span');
        textSpan.setAttribute('class', 'blocklyDropdownText');
        textSpan.textContent = text;
        return textSpan;
    }

    private parseCategory(content: string) {
        return content.slice(0, content.indexOf(' '));
    }

    private setSelectedCategory(value: string) {
        this.selectedCategory_ = value;
    }

    protected categoryClick_(e: any) {
        let value = e.target.getAttribute('data-value');
        this.setSelectedCategory(value);

        const options = this.getOptions();
        options.sort();
        const categories = this.getCategories(options);

        const dropdownDiv = Blockly.DropDownDiv.getContentDiv();
        const categoriesDiv = dropdownDiv.childNodes[0] as HTMLElement;
        const contentDiv = dropdownDiv.childNodes[1] as HTMLDivElement;
        categoriesDiv.innerHTML = '';
        contentDiv.innerHTML = '';

        this.refreshCategories(categoriesDiv, categories);
        this.refreshOptions(contentDiv, options);

        this.stopSounds();
    }

    /**
     * Callback for when a button is hovered over inside the drop-down.
     * Should be bound to the FieldIconMenu.
     * @param {Event} e DOM event for the mouseover
     * @private
     */
    protected buttonEnter_ = function (value: any) {
        if (soundCache) {
            const jresValue = value.substring(value.lastIndexOf('.') + 1);
            const buf = soundCache[jresValue];
            if (buf) {
                const refBuf = {
                    data: pxt.U.stringToUint8Array(atob(buf))
                }
                pxsim.AudioContextManager.playBufferAsync(refBuf as any);
            }
        } 
    };

    protected buttonLeave_ = function () {
        this.stopSounds();
    };

    private stopSounds() {
        pxsim.AudioContextManager.stop();
    }

    private getSoundIcon(indexCategory: number) {
        if (soundIconCacheArray && soundIconCacheArray[indexCategory]) {
            return soundIconCacheArray[indexCategory][1].icon;
        }
        return undefined;
    }
}